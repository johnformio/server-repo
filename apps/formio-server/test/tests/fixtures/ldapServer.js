const ldap = require('ldapjs');
const server = ldap.createServer();

// Sensible defaults + arguments
let port = 1389;
if (process.argv.length > 2) {
  port = process.argv[2] !== 'null' && process.argv[2] !== 'undefined' ? process.argv[2] : port;
}

// Mock user data
const users = [
  {
    dn: 'uid=einstein,dc=example,dc=com',
    attributes: {
      uid: 'einstein',
      mail: 'einstein@example.com',
      cn: 'John Doe',
      objectClass: 'person'
    },
    password: 'password'
  },
  // Add more mock users as needed
];

// TODO: this is a very simple mock, and needs to be expanded to support more LDAP operations
server.bind('dc=example,dc=com', (req, res, next) => {
  const dn = req.dn.toString();
  const password = req.credentials;

  // Find the user by DN
  const user = users.find(user => user.dn.includes(dn));

  if (!user) {
    return next(new ldap.NoSuchObjectError(dn));
  }

  // Simple password check (in real scenarios, use hashed passwords)
  if (user.password !== password) {
    return next(new ldap.InvalidCredentialsError());
  }

  console.log(`Authenticated ${dn}`);
  res.end();
  return next();
});

server.search('dc=example,dc=com', (req, res, next) => {
  const queryFilter = req.filter.toString();
  console.log('Search filter:', queryFilter);

  users.forEach((user) => {
    // Check if the user matches the search filter
    if (req.filter.matches(user.attributes)) {
      res.send({
        dn: user.dn,
        attributes: user.attributes
      });
    }
  });

  res.end();
  return next();
});

server.listen(port, function() {
  process.send({ready: true});
  console.log('Mock LDAP server listening at %s', server.url);
});
