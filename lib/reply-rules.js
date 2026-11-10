// Rules for inbound replies in api/check-replies.js that must not depend on the
// model: delivery failures (bounces) and opt-outs ("stop"). Pure functions.

const BOUNCE_SENDER = /^(mailer-daemon|postmaster)@/i;
const BOUNCE_SUBJECT = /delivery status notification|undeliver|mail delivery (failed|subsystem)|returned mail|delivery (failure|incomplete|has failed)|failure notice/i;
const BOUNCE_BODY = /wasn'?t delivered|couldn'?t be delivered|could not be delivered|delivery incomplete|address not found|message not delivered/i;

// Temporary: the address is fine, the mail just didn't land yet. Leave the lead alone.
const SOFT = /delivery incomplete|temporary problem|will retry|gmail will retry|inbox (is )?full|mailbox (is )?full|over quota|quota exceeded|552 5\.2\.2|try again later|greylist/i;
// Permanent: the address doesn't exist or its domain doesn't resolve.
const HARD = /address not found|couldn'?t be found|unable to receive mail|550 5\.1\.1|550 5\.2\.1|5\.1\.10|no such user|user unknown|does not exist|domain (name )?not found|couldn'?t find the domain|dns error|recipient address rejected/i;

// null = not a bounce, 'hard' = dead address, 'soft' = temporary failure.
function classifyBounce({ fromAddr = '', subject = '', snippet = '' } = {}) {
  const isBounce =
    BOUNCE_SENDER.test(fromAddr) || BOUNCE_SUBJECT.test(subject) || BOUNCE_BODY.test(snippet);
  if (!isBounce) return null;
  const text = `${subject}\n${snippet}`;
  if (SOFT.test(text)) return 'soft';
  if (HARD.test(text)) return 'hard';
  return 'soft'; // unclear: never kill a lead on a guess
}

// A plain "stop" / "unsubscribe" / "not interested", at the top of the reply.
const OPT_OUT_START = /^(?:(?:no|hi|hey|hello)[\s,.!]+)?(?:please[\s,]+)?(?:stop|unsubscribe|remove me|take me off|opt[\s-]?out|no thanks?|no thank you|not interested|don'?t (?:email|contact)|do not (?:email|contact))\b/;
const OPT_OUT_ANYWHERE = /\bunsubscribe\b|stop (?:emailing|sending|contacting)|remove (?:me|us) from|take (?:me|us) off|not interested/;

function isOptOut(text) {
  const head = String(text || '')
    .toLowerCase()
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  if (!head) return false;
  return OPT_OUT_START.test(head) || OPT_OUT_ANYWHERE.test(head);
}

// An explicit request to stop the emails (stronger than "not interested"): the
// lead gets status 'unsubscribed' so nothing is ever sent to it again.
const UNSUBSCRIBE = /^(?:(?:no|hi|hey|hello)[\s,.!]+)?(?:please[\s,]+)?(?:stop|unsubscribe|remove me|take me off|opt[\s-]?out|don'?t (?:email|contact)|do not (?:email|contact))\b|\bunsubscribe\b|stop (?:emailing|sending|contacting)|remove (?:me|us) from|take (?:me|us) off/;

function isUnsubscribe(text) {
  const head = String(text || '').toLowerCase().replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 160);
  return Boolean(head) && UNSUBSCRIBE.test(head);
}

module.exports = { classifyBounce, isOptOut, isUnsubscribe };
