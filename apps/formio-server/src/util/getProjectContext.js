'use strict';
const _ = require('lodash');

module.exports = (req, isNew, res = null, postCreate = false, app = null) => {
    let type = isNew ? _.get(req, 'body.type', 'project') : _.get(req, 'currentProject.type', req.body.type || 'project');

    if (postCreate) {
        type = res.resource?.item?.type;

        if (res.resource?.error) {
            throw new Error(res.resource.error.message);
        }
    }
    const context = {};
    switch (type) {
        case 'tenant':
            context.type = 'tenant';
            if (postCreate) {
                context.environmentId = app.environmentId;
                context.projectId = res.resource.item.project;
                context.tenantId = res.resource.item._id;
                context.title = res.resource.item.title;
                context.name = res.resource.item.name;
                context.remote = _.get(app, 'license.remote', false);
                context.projectType = res.resource.item.type;
                context.stageId = 'none';
            }
            else {
                context.projectId = req.primaryProject ? req.primaryProject._id : ((req.body && req.body.project) ? req.body.project : 'new');
                context.tenantId = req.currentProject && !isNew ? req.currentProject._id : 'new';
                context.title = req.currentProject && !isNew ? req.currentProject.title : req.body.title;
                context.name = req.currentProject && !isNew ? req.currentProject.name : req.body.name;
                context.remote = req.currentProject && !isNew ? !!req.currentProject.remote : false;
                context.projectType = req.currentProject && !isNew ? req.currentProject.type : req.body.type;
                context.stageId = 'none';
            }
            break;
        case 'stage':
            context.type = 'stage';
            context.remoteStage = _.get(req.headers, 'x-remote-token') ? true : _.get(req.currentProject, 'settings.remoteStage', false);
            context.isDefaultAuthoring =
                req.currentProject && !isNew
                    ? _.get(req.currentProject, 'config.defaultStageName', '')
                    : _.get(req, 'body.config.defaultStageName', '')
                 === 'authoring';
            if (postCreate) {
                const isTenantStage = req.currentProject && req.currentProject.type === 'tenant';

                context.environmentId = app.environmentId;
                context.projectId = isTenantStage ? req.currentProject.project : res.resource.item.project;
                context.tenantId = isTenantStage ? res.resource.item.project : 'none';
                context.stageId = res.resource.item._id;
                context.title = res.resource.item.title;
                context.name = res.resource.item.name;
                context.remote = _.get(app, 'license.remote', false);
                context.projectType = res.resource.item.type;
            }
            else {
                context.projectId = req.primaryProject ? req.primaryProject._id : ((req.body && req.body.project) ? req.body.project : 'new');
                context.tenantId = req.currentProject && req.currentProject.type === 'tenant' ? req.currentProject._id : (req.parentProject && req.parentProject._id.toString() !== req.primaryProject._id.toString()) ? req.parentProject._id : 'none';
                context.stageId = req.currentProject && !isNew ? req.currentProject._id : 'new';
                context.title = req.currentProject && !isNew ? req.currentProject.title : req.body.title;
                context.name = req.currentProject && !isNew ? req.currentProject.name : req.body.name;
                context.remote = req.currentProject && !isNew ? !!req.currentProject.remote : false;
                context.projectType = req.currentProject && !isNew ? req.currentProject.type : req.body.type;
            }
            break;
        case 'project':
        default:
            context.type = 'project';
            if (postCreate) {
                context.environmentId = app.environmentId;
                context.projectId = res.resource.item._id;
                context.tenantId = 'none';
                context.stageId = 'none';
                context.title = res.resource.item.title;
                context.name = res.resource.item.name;
                context.remote = _.get(app, 'license.remote', false);
                context.projectType = res.resource.item.type;
            }
            else {
                context.projectId = req.currentProject ? req.currentProject._id : 'new';
                context.title = req.currentProject ? req.currentProject.title : req.body.title;
                context.name = req.currentProject ? req.currentProject.name : req.body.name;
                context.remote = req.currentProject ? !!req.currentProject.remote : false;
                context.projectType = req.currentProject ? req.currentProject.type : req.body.type;
                context.tenantId = 'none';
                context.stageId = 'none';
            }
    }

    return context;
};
