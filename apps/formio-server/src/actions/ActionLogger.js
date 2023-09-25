'use strict';

module.exports = class ActionLogger {
    constructor(router, req, res, action, handler, method, cb) {
        this.router = router;
        this.req = req;
        this.res = res;
        this.action = action;
        this.handler = handler;
        this.method = method;
        this.logsDone = new Promise((resolve, reject) => {
            this.loggerPromise = {resolve, reject};
        });
    }

    log() {
        this.createActionItem((err, actionItem) => {
            this.action.resolve(this.handler, this.method, this.req, this.res, (err) => {
                if (err) {
                    // Error has occurred.
                    this.updateActionItem(actionItem,'Error Occurred', err, 'error');
                    this.loggerPromise.reject(err);
                }

                // Action has completed successfully
                this.updateActionItem(actionItem,
                    'Action Resolved (no longer blocking)',
                    {},
                    actionItem.state === 'inprogress' ? 'complete' : actionItem.state,
                );
                this.loggerPromise.resolve(true);
            }, (...args) => this.updateActionItem(actionItem, ...args));
        });

        return this.logsDone;
    }

    updateActionItem(actionItem, message, data = {}, state = null) {
        if (!this.req.actionItemPromise) {
            this.req.actionItemPromise = Promise.resolve();
        }
        this.req.actionItemPromise = this.req.actionItemPromise.then(() => {
            const update = {
                $addToSet: {
                    messages: {
                        datetime: new Date(),
                        info: message,
                        data
                    }
                }
            };

            if (state) {
                update.state = state;
            }
            return this.router.formio.mongoose.models.actionItem.updateOne({_id: actionItem._id}, update);
        });
    }

        /**
     * Create an action item if the form is enabled with action logs.
     * @param req
     * @param res
     * @param action
     * @param handler
     * @param method
     * @param done
     */
    createActionItem(done) {
        // Instantiate ActionItem here.
        this.router.formio.mongoose.models.actionItem.create({
            title: this.action.title,
            form: this.req.formId,
            submission: this.res.resource ? this.res.resource.item._id : this.req.body._id,
            action: this.action.name,
            handler: this.handler,
            method: this.method,
            state: 'inprogress',
            project: this.req.projectId,
            messages: [
                {
                    datetime: new Date(),
                    info: 'Starting Action',
                    data: {}
                }
            ]
        }, (err, actionItem) => {
            if (err) {
                return done(err);
            }
            return done(null, actionItem);
        });
    }
};
