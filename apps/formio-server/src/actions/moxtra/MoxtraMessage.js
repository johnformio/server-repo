'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:actions:moxtramessage');

module.exports = function(router) {
  const formio = router.formio;
  const Action = formio.Action;
  const Moxtra = require('./utils')(router);
  const Thread = require('formio/src/worker/Thread');
  const Nunjucks = require('formio/src/util/email')(formio);

  /**
   * AuthAction class.
   *   This class is used to create the Authentication action.
   *
   * @constructor
   */
  const MoxtraMessage = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  MoxtraMessage.prototype = Object.create(Action.prototype);
  MoxtraMessage.prototype.constructor = MoxtraMessage;
  MoxtraMessage.info = function(req, res, next) {
    next(null, {
      name: 'moxtraMessage',
      title: 'Moxtra Message',
      description: 'Provides a way to Create new Moxtra Chat Messages',
      priority: -10,
      defaults: {
        handler: ['after'],
        method: ['create']
      },
      access: {
        handler: false,
        method: false
      },
      validate: {
        required: true
      }
    });
  };

  /**
   * Settings form
   *
   * @param req
   * @param res
   * @param next
   */
  MoxtraMessage.settingsForm = function(req, res, next) {
    if (!_.has(req.user, 'externalIds')) {
      return res.status(400).send(`Could not access user token.`);
    }
    const userToken = _.filter(req.user.externalIds, {type: `moxtra`});
    if (!userToken) {
      return res.status(400).send(`Moxtra token not found for the current user.`);
    }

    Moxtra.getToken(req, req.user)
    .then(token => Moxtra.getBinder(req, token))
    .then(response => {
      const binders = response.binders;

      return next(null, [
        {
          conditional: {
            eq: '',
            when: null,
            show: ''
          },
          tags: [],
          type: 'hidden',
          persistent: true,
          unique: false,
          protected: false,
          label: 'user',
          key: 'user',
          tableView: true,
          input: true
        },
        {
          type: 'select',
          input: true,
          label: 'Binder',
          key: 'binder',
          placeholder: 'Select the Binder to send a Message to',
          dataSrc: 'json',
          data: {json: JSON.stringify(binders)},
          valueProperty: 'binder.id',
          template: '<span>{{ item.binder.name }}</span>',
          multiple: false,
          validate: {
            required: true
          }
        },
        {
          label: 'Message',
          key: 'message',
          type: 'textarea',
          defaultValue: `A new submission was created!

{% for key, value in data %}
    {{ key }}: {{ value }}
{% endfor %}`,
          multiple: false,
          rows: 7,
          suffix: '',
          prefix: '',
          placeholder: 'Enter the message you would like to send.',
          input: true,
          validate: {
            required: true
          }
        }
      ]);
    })
    .catch(err => {
      return res.status(400).send(err.message || err);
    });
  };

  /**
   *
   *
   * @param handler
   * @param method
   * @param req {Object}
   *   The Express request object.
   * @param res {Object}
   *   The Express response object.
   * @param next {Function}
   *   The callback function to execute upon completion.
   */
  MoxtraMessage.prototype.resolve = function(handler, method, req, res, next) {
    // Load the form for this request.
    router.formio.cache.loadCurrentForm(req, (err, form) => {
      if (err) {
        return next(err);
      }
      if (!form) {
        return res.status(404).send(`Form not found.`);
      }
      if (!this.settings.user) {
        return res.status(401).send(`MoxtraMessage action missing user settings.`);
      }

      // Dont block on sending messages.
      next(); // eslint-disable-line callback-return

      // Get the Nunjucks parameters.
      Nunjucks.getParams(res, form, req.body)
      .then(params => {
        const query = {
          _id: params.owner,
          deleted: {$eq: null}
        };

        return router.formio.resources.submission.model.findOne(query)
        .then(owner => {
          if (owner) {
            params.owner = owner.toObject();
          }

          // Use nunjucks on the message.
          return new Thread(Thread.Tasks.nunjucks)
          .start({
            render: this.settings.message,
            context: params
          })
          .then(injectedMessage => {
            return Moxtra.getToken(req, this.settings.user)
            .then(token => Moxtra.addMessageToBinder(req, injectedMessage, this.settings.binder, token));
          });
        });
      })
      .catch(err => {
        debug(err);
      });
    });
  };

  // Return the MoxtraMessage.
  return MoxtraMessage;
};
