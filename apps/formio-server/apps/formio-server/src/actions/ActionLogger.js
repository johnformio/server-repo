'use strict';

module.exports = class ActionLogger {
    constructor(router, req, res, action, handler, method, cb) {
        this.router = router;
        this.req = req;
        this.res = res;
        this.action = action;
        this.handler = handler;
        this.method = method;
    }

    log(done) {
        this.createActionItem((err, actionItem) => {
            this.action.resolve(this.handler, this.method, this.req, this.res, (err) => {
                if (err) {
                    // Error has occurred.
                    this.updateActionItem(actionItem,'Error Occurred', err, 'error');
                    return done(err);
                }

                // Action has completed successfully
                this.updateActionItem(actionItem,
                    'Action Resolved (no longer blocking)',
                    {},
                    actionItem.state === 'inprogress' ? 'complete' : actionItem.state,
                );
                return done(null, true);
            }, (...args) => this.updateActionItem(actionItem, ...args));
        });
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
    async createActionItem(done) {
        // Instantiate ActionItem here.
        try {
            const actionItem = await this.router.formio.mongoose.models.actionItem.create({
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
            });
            return done(null, actionItem);
        }
        catch (err) {
            return done(err);
        }
    }
};
