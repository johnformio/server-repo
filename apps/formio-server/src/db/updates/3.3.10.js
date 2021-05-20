'use strict';
const _ = require('lodash');
const mongodb = require('mongodb');

/**
 * Update 3.3.10
 *
 * Update emails to be lower case.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function(db, config, tools, done) {
  // Perform in background.
  done();

  const forms = await db.collection('forms');
  const submissionsDb = await db.collection('submissions');
  const dataToUpdate = {};

  const getEmailComponent = (components, formId) => {
    const items = {[formId]: []};
    const getEmails = (components) => {
      for(let i = 0; i<components.length; i++){
        if(components[i].type === 'email') {
          items[formId].push(components[i].key);
        }
        if(components[i].components){
          getEmails(components[i].components)
        }
      }
    }
    getEmails(components)
    return items;
  }

  forms.find({deleted: { $eq: null }}).forEach(form=>{
    const currentFormEmails = getEmailComponent(form.components, form._id);

     if(currentFormEmails[form._id].length!==0){
        Object.assign(dataToUpdate, currentFormEmails);
     }
  }, (err)=>{
    if(err){
      console.log(err.message);
    }

    const formsId = Object.keys(dataToUpdate).map(id=>mongodb.ObjectID(id))
    submissionsDb.find({form : {$in: formsId}, deleted: { $eq: null }}).forEach(submission=>{
      const keys = {}
      dataToUpdate[submission.form].forEach(e=>keys[`data.${e}`] = submission.data[e].toLowerCase());
      submissionsDb.updateOne({_id: submission._id}, {$set: keys});
    }, (err)=>{
        if(err){
          console.log(err.message);
        }
        console.log('Done!');
    })
  })
 };
