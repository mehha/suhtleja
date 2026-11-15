// The PIN every new account starts with (the Users collection hashes it on create). The register
// form names it; the PIN dialog names it after a wrong PIN while the account still has it.
export const DEFAULT_PARENT_PIN = process.env.DEFAULT_PARENT_PIN || '0000'

// Where the PIN dialog sends a parent who forgot the PIN or has none: the profile's PIN card.
export const PIN_SETTINGS_ID = 'vanema-pin'
export const PIN_SETTINGS_HREF = `/profile#${PIN_SETTINGS_ID}`

// Changing the parent PIN is a parent action. In the child view it needs the account password
// (a parent who forgot the PIN), unless no PIN is set yet: then there is no lock to get around.
export const pinChangeNeedsPassword = ({ hasPin, isParentMode }: { hasPin: boolean; isParentMode: boolean }) =>
  hasPin && !isParentMode
