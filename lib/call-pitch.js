// The call pitch sent to people who already have the guides: those who replied
// "send" (api/send-followups.js) and those who signed up through the emailed
// link (stage 5 of the drip in api/send-starter-kit-drip.js). The CTA is a
// button to the Calendly "15-minute phone call" event, where Gabriel calls them.

const CALL_URL = 'https://calendly.com/hello-griffincreativelab/15-minute-phone-call';
const CALL_CTA_LABEL = "Pick a time and I'll call you";
const CALL_SIGNATURE = '\n\ngabriel\ngriffincreative\ngriffincreativelab.com';

function buildCallPitch({ first } = {}) {
  return (
    `hi ${first || 'there'},\n\n` +
    `hope the guides are useful. i'd love to hear what you think of them, and show you how we can help ` +
    `get more people seeing your business year round: improving your google presence, emailing past hunters ` +
    `to rebook, asking for reviews after every hunt, and content timed around your booking seasons and tag ` +
    `draw dates. i can also build a referral system for you if you want one.\n\n` +
    `got 10-15 minutes? pick a time and i'll call you:\n\n` +
    `${CALL_URL}\n\n` +
    `or just reply with a time that works.` +
    CALL_SIGNATURE
  );
}

module.exports = { CALL_URL, CALL_CTA_LABEL, buildCallPitch };
