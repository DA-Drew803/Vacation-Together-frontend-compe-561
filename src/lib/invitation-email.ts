const invitationSubject = "Invitation to plan a trip on Vacation Together";

export function buildInvitationMailto(
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

  return `mailto:${encodeURIComponent(inviteeEmail)}?subject=${encodeURIComponent(invitationSubject)}&body=${encodeURIComponent(body)}`;
}
