const { sendAlertEmail } = require('./emailService');

function shouldTriggerBurnout(entries) {
  const minCount = Number(process.env.ALERT_MIN_STRESS_ENTRIES || 5);
  const minIntensity = Number(process.env.ALERT_MIN_INTENSITY || 0.7);

  const stressEntries = entries.filter((entry) => {
    const emotion = entry.emotion?.primary;
    const intensity = Number(entry.emotion?.intensity || 0);
    return ['stress', 'anxiety'].includes(emotion) && intensity >= minIntensity;
  });

  return stressEntries.length >= minCount
    ? {
        alert_type: 'burnout_risk',
        severity: 'high',
        title: 'Sustained High Stress Detected',
        description: `Detected ${stressEntries.length} high-stress entries recently.`,
      }
    : null;
}

async function triggerAlertEmails(user, alert) {
  if (!user?.settings?.alerts_enabled) {
    return [];
  }

  const contacts = (user.trusted_contacts || []).filter((c) => c?.email);
  const sent = [];

  for (const contact of contacts) {
    try {
      await sendAlertEmail({
        to: contact.email,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        text: `${alert.description}\n\nPlease check in with ${user.name || 'your contact'} soon.`,
      });
      sent.push({ recipient: contact.email, sent_at: new Date(), status: 'sent' });
    } catch (error) {
      sent.push({ recipient: contact.email, sent_at: new Date(), status: 'failed' });
    }
  }

  return sent;
}

module.exports = {
  shouldTriggerBurnout,
  triggerAlertEmails,
};
