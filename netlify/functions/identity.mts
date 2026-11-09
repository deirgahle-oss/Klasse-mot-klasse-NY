// Enforce invitation-only access even if registration is accidentally left open.
export default {
 userValidate(event:any) { if(!event.user.invitedAt && !event.user.invited_at) return event.deny(); },
};
