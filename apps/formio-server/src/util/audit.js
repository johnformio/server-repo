'use strict';

module.exports = (req, res, json, audit) => {
  try {
    const entities = [
      'action',
      'submission',
      'form',
      'project',
      'role',
    ];
    const route = req.route.path;
    const handler = {
      'GET': 'READ',
      'POST': 'CREATE',
      'PUT': 'UPDATE',
      'PATCH': 'UPDATE',
      'DELETE': 'DELETE',
    }[req.method.toUpperCase()];

    let entity = false;

    const parts = route.split('/').reverse();

    parts.forEach(part => {
      if (!entity && entities.includes(part)) {
        entity = part.toUpperCase();
      }
    });

    let body = JSON.parse(json);

    if (!Array.isArray(body)) {
      body = [body];
    }

    body.forEach(item => {
      if (item._id) {
        audit(`${entity}_${handler}`, req, item._id, item.form || '');
      }
    });
  }
  catch (err) {
    // Do nothing
  }
};
