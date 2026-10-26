// Changing the parent PIN is a parent action. In the child view it needs the account password
// (a parent who forgot the PIN), unless no PIN is set yet: then there is no lock to get around.
export const pinChangeNeedsPassword = ({ hasPin, isParentMode }: { hasPin: boolean; isParentMode: boolean }) =>
  hasPin && !isParentMode
