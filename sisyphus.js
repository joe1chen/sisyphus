/**
 * Plugin developed to save html forms data to LocalStorage to restore them after browser crashes, tabs closings
 * and other disasters.
 *
 * @author Alexander Kaupanin <kaupanin@gmail.com>
 */

  //$.sisyphus().setOptions({timeout: 15})
( function( $ ) {
  $.sisyphus = function() {
    return Sisyphus.getInstance();
  };

  $.fn.sisyphus = function( options ) {
    var sisyphus = Sisyphus.getInstance();
    sisyphus.setOptions( options );
    sisyphus.protect( this );
    return sisyphus;
  };

  var browserStorage = {};

  /**
   * Check if local storage or other browser storage is available
   *
   * @return Boolean
   */
  browserStorage.isAvailable = function() {
    if ( typeof $.jStorage === "object" ) {
      return true;
    }
    try {
      return localStorage.getItem;
    } catch ( e ) {
      return false;
    }
  };

  /**
   * Set data to browser storage
   *
   * @param [String] key
   * @param [String] value
   *
   * @return Boolean
   */
  browserStorage.set = function( key, value ) {
    if ( typeof $.jStorage === "object" ) {
      $.jStorage.set( key, value + "" );
    } else {
      try {
        localStorage.setItem( key, value + "" );
      } catch (e) {
        //QUOTA_EXCEEDED_ERR
      }
    }
  };

  /**
   * Get data from browser storage by specified key
   *
   * @param [String] key
   *
   * @return string
   */
  browserStorage.get = function( key ) {
    if ( typeof $.jStorage === "object" ) {
      var result = $.jStorage.get( key );
      return result ? result.toString() : result;
    } else {
      return localStorage.getItem( key );
    }
  };

  /**
   * Delete data from browser storage by specified key
   *
   * @param [String] key
   *
   * @return void
   */
  browserStorage.remove = function( key ) {
    if ( typeof $.jStorage === "object" ) {
      $.jStorage.deleteKey( key );
    } else {
      localStorage.removeItem( key );
    }
  };

  Sisyphus = ( function() {
    var params = {
      instantiated: null,
      started: null
    };

    function init () {

      return {
        /**
         * Set plugin initial options
         *
         * @param [Object] options
         *
         * @return void
         */
        setInitialOptions: function ( options ) {
          var defaults = {
            excludeFields: null,
            customKeyPrefix: "",
            timeout: 0,
            autoRelease: true,
            onSave: function() {},
            onRestore: function() {},
            onRelease: function() {}
          };
          this.options = this.options || $.extend( defaults, options );
          this.browserStorage = browserStorage;
        },

        /**
         * Set plugin options
         *
         * @param [Object] options
         *
         * @return void
         */
        setOptions: function ( options ) {
          this.options = this.options || this.setInitialOptions( options );
          this.options = $.extend( this.options, options );
        },


        /**
         * Protect specified forms, store it's fields data to local storage and restore them on page load
         *
         * @param [Object] targets		forms object(s), result of jQuery selector
         * @param Object options			plugin options
         *
         * @return void
         */
        protect: function( targets ) {
          targets = targets || {};
          var self = this;
          this.targets = this.targets || [];
          this.href = location.hostname + location.pathname + location.search;

          this.targets = $.merge( this.targets, targets );
          this.targets = $.unique( this.targets );
          this.targets = $( this.targets );
          if ( ! this.browserStorage.isAvailable() ) {
            return false;
          }

          self.restoreAllData();
          if ( this.options.autoRelease ) {
            self.bindReleaseData();
          }
          if ( ! params.started ) {
            self.bindSaveData();
            params.started = true;
          }
        },

        /**
         * Bind saving data
         *
         * @return void
         */
        bindSaveData: function() {
          var self = this;

          if ( self.options.timeout ) {
            self.saveDataByTimeout();
          }

          self.targets.each( function() {
            var fieldsToSave = $(this.elements).not(":submit").not(":reset").not(":button");
            if (self.options.excludeFields) {
              fieldsToSave = fieldsToSave.not(self.options.excludeFields);
            }

            fieldsToSave.each( function() {
              var field = $( this );
              if ( field.is( ":text" ) || field.is( "textarea" ) ) {
                if ( ! self.options.timeout ) {
                  self.bindSaveDataImmediately( field );
                }
              } else {
                self.bindSaveDataOnChange( field );
              }
            } );
          } );
        },


        /**
         * Save all protected forms data to Local Storage.
         * Common method, necessary to not lead astray user firing 'data are saved' when select/checkbox/radio
         * is changed and saved, while textfield data are saved only by timeout
         *
         * @return void
         */
        saveAllData: function() {
          var self = this;
          self.targets.each( function() {
            var targetFormId = $( this ).attr( "id" );
            var fieldsToSave = $(this.elements).not(":submit").not(":reset").not(":button");
            if (self.options.excludeFields) {
              fieldsToSave = fieldsToSave.not(self.options.excludeFields);
            }
            var value = fieldsToSave.serialize();
            var prefix = self.href + targetFormId + self.options.customKeyPrefix;
            self.saveToBrowserStorage( prefix, value, false );
          } );
          if ( $.isFunction( self.options.onSave ) ) {
            self.options.onSave.call();
          }
        },


        /**
         * Restore forms data from Local Storage
         *
         * @return void
         */
        restoreAllData: function() {
          var self = this;

          self.targets.each( function() {
            var target = $( this );
            var targetFormId = target.attr( "id" );
            var prefix = self.href + targetFormId + self.options.customKeyPrefix;
            var resque = self.browserStorage.get( prefix );
            if ( resque ) {
              target.deserialize(resque, function () {
                if ( $.isFunction( self.options.onRestore ) ) {
                  self.options.onRestore.call();
                }
              });
            }
          } );
        },

        /**
         * Bind immediate saving (on typing/checking/changing) field data to local storage when user fills it
         *
         * @param Object field		jQuery form element object
         *
         * @return void
         */
        bindSaveDataImmediately: function( field, prefix ) {
          var self = this;
          var editor;
          try { editor = $(field.get(0)).ckeditorGet(); } catch(e) {}
          //for ckeditor
          if(editor) {
            editor.on('saveSnapshot', function(evt) {
              self.saveAllData();
            });
            editor.getCommand('undo').on( 'afterUndo', function(e) {
              self.saveAllData();
            });
            editor.getCommand('redo').on( 'afterRedo', function(e) {
              self.saveAllData();
            });
          }
          else if ( $.browser.msie == null ) {
            field.get(0).oninput = function() {
              self.saveAllData();
            };
          } else {
            field.get(0).onpropertychange = function() {
              self.saveAllData();
            };
          }
        },


        /**
         * Save data to Local Storage and fire callback if defined
         *
         * @param String key
         * @param String value
         * @param Boolean [true] fireCallback
         *
         * @return void
         */
        saveToBrowserStorage: function( key, value, fireCallback ) {
          // if fireCallback is undefined it should be true
          fireCallback = fireCallback == null ? true : fireCallback;
          this.browserStorage.set( key, value );
          if ( fireCallback && value !== "" && $.isFunction( this.options.onSave ) ) {
            this.options.onSave.call();
          }
        },


        /**
         * Bind saving field data on change
         *
         * @param Object field		jQuery form element object
         *
         * @return void
         */
        bindSaveDataOnChange: function( field ) {
          var self = this;
          field.change( function() {
            self.saveAllData();
          } );
        },


        /**
         * Saving (by timeout) field data to local storage when user fills it
         *
         * @return void
         */
        saveDataByTimeout: function() {
          var self = this;
          var targetForms = self.targets;
          setTimeout( ( function( targetForms ) {
            function timeout() {
              self.saveAllData();
              setTimeout( timeout, self.options.timeout * 1000 );
            }
            return timeout;
          } )( targetForms ), self.options.timeout * 1000 );
        },


        /**
         * Bind release form fields data from local storage on submit/reset form
         *
         * @return void
         */
        bindReleaseData: function() {
          var self = this;
          self.targets.each( function( i ) {
            var target = $( this );
            var formId = target.attr( "id" );
            $( this ).bind( "submit reset", function() {
              self.releaseData( formId );
            } );
          } );
        },

        /**
         * Manually release form fields
         *
         * @return void
         */
        manuallyReleaseData: function() {
          var self = this;
          self.targets.each( function( i ) {
            var target = $( this );
            var formId = target.attr( "id" );
            self.releaseData( formId );
          } );
        },

        /**
         * Bind release form fields data from local storage on submit/resett form
         *
         * @param String targetFormId
         * @param Object fieldsToProtect		jQuery object contains form fields to protect
         *
         * @return void
         */
        releaseData: function( targetFormId, fieldsToProtect ) {
          var released = false;
          var self = this;
          var prefix = self.href + targetFormId + self.options.customKeyPrefix;
          self.browserStorage.remove( prefix );
          released = true;

          if ( released && $.isFunction( self.options.onRelease ) ) {
            self.options.onRelease.call();
          }
        }

      };
    }

    return {
      getInstance: function() {
        if ( ! params.instantiated ) {
          params.instantiated = init();
          params.instantiated.setInitialOptions();
        }
        return params.instantiated;
      },

      free: function() {
        params = {};
        return null;
      }
    };
  } )();
} )( jQuery );