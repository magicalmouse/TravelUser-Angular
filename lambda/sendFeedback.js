var util = require('./util');
var gCallback;

exports.sendFeedback = (event, callback) => {
	//send user feedback to the gitlab portal project via email
	gCallback = callback;
	var smtpConfig = {
		host: 'email-smtp.us-east-1.amazonaws.com',
		port: 587,
		secure: false,
		auth: {
			user: 'AKIARTNPUXZ6T4Q26XGM',
			pass: 'BBpaHp0B2MmeVF+aGe7GPUau+NCF+Qpc5Y8E/WnQrWdA',
		},
	};
	var transporter = require('nodemailer').createTransport(smtpConfig);
	var MailOptions = formatBusinessPortalEmail(event);
	transporter.sendMail(MailOptions, function (err, info) {
		if (err) {
			gCallback(
				null,
				util.configureResponse({ status: 'EMAIL_ERROR', error: err })
			);
		} else {
			gCallback(null, util.configureResponse({ status: 'OK' }));
		}
	});
};

function formatBusinessPortalEmail(event) {
	const to =
		'incoming+nationaltaxiservices/BusinessPortal@incoming.gitlab.com';
	const from = 'support@nts.taxi';

	let text =
		'<pre>Taxi Account Portal Feedback:\n\n' +
		'Name: ' +
		event.name +
		'\n' +
		'Email: ' +
		event.email +
		'\n' +
		'Subject: ' +
		event.subject +
		'\n' +
		event.text +
		'</pre>';

	let subject = 'Feedback-' + event.email + '-' + event.subject;

	let HelperOptions = {
		from: from,
		to: to,
		subject: subject,
		text: text,
		html: text,
		replyTo: event.email,
	};

	return HelperOptions;
}
