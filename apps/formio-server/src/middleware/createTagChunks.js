'use strict';

const debug = require('debug')('formio:resources:tag');
const Q = require('q');

module.exports = (formio) => {
  const createTemplate = (project, tag, template) => formio.mongoose.model('tag').create({chunk: true, project, tag, template});

  return (req, res, next) => {
     if (res.resource.status===201) {
      const project = req.body.project;
      const tag = req.body.tag;
      const {actions, forms, resources} = req.templateData;

      const parseActions = (itemType, itemArr) => {
        const result = [];
        for (const key in itemArr) {
          const template = {
            [itemType]: {[key]: itemArr[key]},
            actions: {}
          };
          Object.entries(actions).reduce((accum, curr, index, actionsArr)=>{
            if (curr[0].match(`^${key}:`)) {
              accum.actions[curr[0]] = curr[1];
              delete actions[curr[0]];
            }
            return accum;
          }, template);
          result.push(createTemplate(project, tag, template));
        }
        return result;
       };

      const formsArr = parseActions('forms', forms);
      const resourcesArr = parseActions('resources', resources);
      Q.all(formsArr.concat(resourcesArr))
      .then(()=>next())
      .catch(err=>{
        debug(err);
        next(err.message || err);
      });
     }
    else {
       return next();
     }
  };
};

