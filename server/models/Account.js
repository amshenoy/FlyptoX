var uuid = require("node-uuid");
var bookshelf = require('../utils/bookshelf');

require("./User");
require("./Transaction");
require("./Currency");

var Account = module.exports = bookshelf.model('Account', {
  tableName: 'accounts',

  initialize: function(){
    this.on('creating', this.onCreate, this);
  },

  onCreate: function(model, attrs, options) {
    var self = this;
    self.set('id', uuid.v4());
  },

  //owner of the account
  user: function(){
    return this.belongsTo("User", "user_id");
  },

  transactions: function() {
    return this.hasMany("Transaction", "account_id");
  },

  currency: function(){
    return this.belongsTo("Currency", "currency_id");
  }
});
