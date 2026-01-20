import { User } from '../types';

// Change: Adding prefix to prevent collision with other keys
const USER_STORAGE_KEY_PREFIX = 'shishi_shitufi_user_';

// Internal helper function to create the key
function getUserStorageKey(uid: string): string {
  return `${USER_STORAGE_KEY_PREFIX}${uid}`;
}

export function saveUserToLocalStorage(user: User): void {
  try {
    // Save under unique key for user
    if (!user.id) {
        console.error("Attempted to save user without ID.");
        return;
    }
    localStorage.setItem(getUserStorageKey(user.id), JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user to localStorage:', error);
  }
}

// Change: Function receives uid to know which user to retrieve
export function getUserFromLocalStorage(uid: string): User | null {
  try {
    const userStr = localStorage.getItem(getUserStorageKey(uid));
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
    return null;
  }
}

// Change: Function needs to know the ID of the user being updated
export function updateUserInLocalStorage(updates: Partial<User>): void {
  if (!updates.id) {
      console.error("Cannot update user in localStorage without a user ID.");
      return;
  }
  try {
    const currentUser = getUserFromLocalStorage(updates.id);
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      saveUserToLocalStorage(updatedUser);
    }
  } catch (error) {
    console.error('Error updating user in localStorage:', error);
  }
}