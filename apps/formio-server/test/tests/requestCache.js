/* eslint-env mocha */
'use strict';

const assert = require('assert');
const sinon = require('sinon');
const NodeCache = require('node-cache');

const RequestCache = require('../../src/util/requestCache');

module.exports = function() {
  describe('RequestCache', () => {
    let requestCache;

    beforeEach(() => {
      requestCache = new RequestCache()
    });

    describe('Add Request', () => {
      const mockNamespace = 'ns';
      const mockKey = 'key';
      const mockRequest = {method: 'GET', code: 200};
      const mockTtl = 60;

      it('Sets correct request', () => {
        requestCache.namespaces[mockNamespace] = new NodeCache();
        sinon.spy(requestCache.namespaces[mockNamespace], 'set');

        requestCache.addRequest(mockNamespace, mockKey, mockRequest, mockTtl);
        const args = requestCache.namespaces[mockNamespace].set.args[0];
        assert.deepEqual(args, [mockKey, {method: 'GET', status: '2xx'}, 60]);

        requestCache.namespaces[mockNamespace].set.restore();
      });

      describe('Handle namespaces', () => {
        it('Creates new namespace', () => {
          assert.equal(requestCache.namespaces[mockNamespace], undefined);
          requestCache.addRequest(mockNamespace, mockKey, mockRequest, mockTtl);
          assert(requestCache.namespaces[mockNamespace]);
        });

        it('Adds request to existing namespace', () => {
          assert.equal(requestCache.namespaces[mockNamespace], undefined);

          requestCache.addRequest(mockNamespace, mockKey, mockRequest, mockTtl);
          requestCache.addRequest(mockNamespace, `${mockKey}-2`, mockRequest, mockTtl);

          assert(requestCache.namespaces[mockNamespace]);
          assert.equal(requestCache.namespaces[mockNamespace].keys().length, 2);
        });

        it('Gets namespaces', () => {
          assert.equal(requestCache.getNamespaces().length, 0);
          const namespaces = [mockNamespace, `${mockNamespace}-2`]

          requestCache.addRequest(namespaces[0], mockKey, mockRequest, mockTtl);
          requestCache.addRequest(namespaces[1], `${mockKey}-2`, mockRequest, mockTtl);

          assert.deepEqual(requestCache.getNamespaces(), namespaces);
        });
      });
    });

    describe('Get requests data', () => {
      const mockNamespace = 'ns';
      const mockTtl = 60;

      it('Returns empty object if namespace wasn\'t found', () => {
        const requestsData = requestCache.getRequestsData('unknown_namespace');
        assert.deepEqual(requestsData, {});
      });

      describe('Filled namespace', () => {
        const mockRequests = [
          {ns: mockNamespace, key: '1', method: 'GET', code: 200, status: '2xx'},
          {ns: mockNamespace, key: '2', method: 'POST', code: 201, status: '2xx'},
          {ns: mockNamespace, key: '3', method: 'GET', code: 404, status: '4xx'},
        ];

        beforeEach(() => {
          mockRequests.forEach((req) => {
            requestCache.addRequest(req.ns, req.key, {method: req.method, code: req.code}, mockTtl);
          });
        });

        it('Iterates over each key in namespace', () => {
          sinon.spy(requestCache.namespaces[mockNamespace], 'get');

          requestCache.getRequestsData(mockNamespace);
          const calls = requestCache.namespaces[mockNamespace].get.getCalls();

          assert.equal(calls.length, mockRequests.length);
          calls.forEach((call, index) => {
            assert.deepEqual(call.args, [mockRequests[index].key]);
          })

          requestCache.namespaces[mockNamespace].get.restore();
        });

        it('Returns correct data', () => {
          sinon.stub(requestCache.namespaces[mockNamespace], 'get').callsFake((key) => {
            return mockRequests.find((req) => req.key === key);
          });

          const requestsData = requestCache.getRequestsData(mockNamespace);
          assert.deepEqual(requestsData, {
            'GET': {
              '2xx': 1,
              '4xx': 1
            },
            'POST': {
              '2xx': 1,
            },
          });

          requestCache.namespaces[mockNamespace].get.restore();
        });
      });
    });
  });
}
