// accountManager
// withhold / clear accounts
var bookshelf = require("../utils/bookshelf");
var Promise = require("bluebird");

// our export object
var accountManager = module.exports;

accountManager.getAccountBalance = function(account){
  return bookshelf.model('Account')
    .where({id:account.get('id')}).fetch({withRelated:'transactions', required:true})
    .then(function(account){
      return account.related('transactions').reduce(function(balance, transaction){
        return balance + transaction.get('credit') - transaction.get('debit');
      },0);
    });
};

accountManager.getUserHolds = function(user_id){
  //for each currency pair in currency_pairs array...
  return bookshelf.model('Order')
    .where({user_id:user_id, status:'open'})
    .fetchAll({withRelated:'currency_pair'})
    .then(function(orders){
      var holds = {};
      orders.each(function(order){
        var currency, hold;
        if(order.get('side') === 'sell') {
          currency = order.related('currency_pair').get('base_currency_id');
          hold = order.get('size') - order.get('filled_size');
        } else {
          currency = order.related('currency_pair').get('quote_currency_id');
          hold = (order.get('size') - order.get('filled_size'))*order.get('price');
        }
        holds[currency] = holds[currency] ? holds[currency] + hold : hold;
      });
      return holds;
    });
};

accountManager.getAccountHoldAmount = function(account){
  return accountManager.getUserHolds(account.get('user_id'))
    .then(function(holds){
      return holds[account.get('currency_id')] || 0;
  });
};

accountManager.getAccountAvailableBalance = function(account){
  return accountManager.getAccountBalance(account)
    .then(function(balance){
      return accountManager.getAccountHoldAmount(account)
        .then(function(hold){
          return balance - hold;
      });
    });
};

accountManager.getUserBaseCurrencyAccount = function(user_id, currency_pair_id) {
  return bookshelf.model('CurrencyPair')
    .where({id:currency_pair_id}).fetch({required:true})
    .then(function(pair){
      return bookshelf.model('Account')
        .where({user_id:user_id, currency_id:pair.get('base_currency_id')}).fetch({required:true});
    });
};

accountManager.getUserQuoteCurrencyAccount = function(user_id, currency_pair_id) {
  return bookshelf.model('CurrencyPair')
    .where({id:currency_pair_id}).fetch({required:true})
    .then(function(pair){
      return bookshelf.model('Account')
        .where({user_id:user_id, currency_id:pair.get('quote_currency_id')})
        .fetch({required:true});
    });
};

accountManager.orderIsCovered = function(orderRequest) {
  if(orderRequest.side === 'sell') {
    return accountManager
      .getUserBaseCurrencyAccount(orderRequest.user_id, orderRequest.currency_pair_id)
      .then(accountManager.getAccountAvailableBalance)
      .then(function(available){
        return available >= orderRequest.size; //todo available >= order.size + fees?
      });
  } else {
    return accountManager
      .getUserQuoteCurrencyAccount(orderRequest.user_id, orderRequest.currency_pair_id)
      .then(accountManager.getAccountAvailableBalance)
      .then(function(available){
        return available >= orderRequest.size * orderRequest.price; //todo available >= order.size + fees?
      });
  }
};