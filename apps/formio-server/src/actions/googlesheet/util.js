/*jslint node: true */
'use strict';
module.exports = {
	/**
	 * Verifying setting form data and restricting action form loading
	 * if any of the setting field data missing.
	 */
	checkOauthParameters: function (router, req, next) {
		router.formio.hook.settings(req, function (err, settings) {
			var CLIENT_ID = settings.googlesheet.clientId,
				CLIENT_SECRET = settings.googlesheet.cskey,
				REFRESH_TOKEN = settings.googlesheet.refreshtoken;

			if (!settings.googlesheet) {
				return next('Googlesheet not configured.');
			}
			if (!CLIENT_ID) {
				return next('Googlesheet not configured.');
			}
			if (!CLIENT_SECRET) {
				return next('Googlesheet not configured.');
			}
			if (!REFRESH_TOKEN) {
				return next('Googlesheet not configured.');
			}
			next();
		});
	}
};