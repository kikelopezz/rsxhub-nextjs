import type es from '../es/registration'

const registration: typeof es = {
  status: {
    approved: 'Approved',
    pending: 'Pending',
    waitlist: 'Waitlist',
    rejected: 'Rejected',
  },
  yourTeamRegistered: 'YOUR TEAM - REGISTERED',
  withdraw: 'Withdraw',
  registerTeam: 'Register Team',
  requirementTitle: 'REGISTRATION REQUIREMENT',
  requirementBody: 'You must be the leader or founder of a team to register vehicles in this league.',
  accessRequiredTitle: 'ACCESS REQUIRED',
  accessRequiredBody: 'Log in with Steam and be a team leader to register.',
}

export default registration
