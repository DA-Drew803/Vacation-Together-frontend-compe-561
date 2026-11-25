const invitationSubject = "Invitation to plan a trip on Vacation Together";

export function buildInvitationEmailDraft(
  inviteeEmail: string,
  invitationUrl: string,
) {
  const body = [
    "Hi,",
    "",
    "You’re invited to plan a trip with me on Vacation Together.",
    "",
    "Open this invitation:",
    invitationUrl,
  ].join("\n");

  return { to: inviteeEmail, subject: invitationSubject, body };
}

export function buildInvitationMailto(
  inviteeEmail: string,
  invitationUrl: string,
) {
  const { to, subject, body } = buildInvitationEmailDraft(inviteeEmail, invitationUrl);

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildInvitationGmailUrl(
  inviteeEmail: string,
  invitationUrl: string,
) {
  const { to, subject, body } = buildInvitationEmailDraft(inviteeEmail, invitationUrl);
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
