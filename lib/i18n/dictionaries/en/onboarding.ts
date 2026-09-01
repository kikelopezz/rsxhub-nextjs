import type es from '../es/onboarding'

const onboarding: typeof es = {
  page: {
    welcome: 'Welcome to the Platform',
    title: 'Complete Your Driver Profile',
    subtitle: 'Set your initial preferences to customize your sim racing experience.',
  },
  form: {
    syncedAccount: 'Synced Steam Account',
    privacyNote: 'We display your Steam profile picture directly without downloading to preserve privacy.',
    driverName: 'Driver Name (Display Name)',
    driverNamePlaceholder: 'e.g. Max_Verstappen',
    driverNameHint: 'This name will be displayed across leaderboards and registrations.',
    country: 'Select Your Country',
    countryHint: 'Your country determines the flag displayed next to your driver name.',
    primarySimulator: 'Primary Simulator',
    assettoCorsa: 'Assetto Corsa',
    assettoCorsaSubtitle: 'AC Racing Platform',
    leMansUltimate: 'Le Mans Ultimate',
    leMansUltimateSubtitle: 'LMU WEC Platform',
    preferredCategories: 'Preferred Categories',
    preferredCategoriesHint: 'Select the vehicle classes you prefer competing in.',
    submitProcessing: 'Processing registration...',
    submit: 'Save Profile & Enter Cockpit',
  },
}

export default onboarding
