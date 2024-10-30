// stores/core/ShareFormStore.js
import { makeAutoObservable } from 'mobx';

/**
 * Manages the state and validation of sharing forms
 */
class ShareFormStore {
    emails = [];

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    /**
     * Set an email at a specific index
     * @param {number} index - The index in the emails array
     * @param {string} email - The email address
     */
    setEmail(index, email) {
        if (index >= this.emails.length) {
            this.emails.length = index + 1;
        }
        this.emails[index] = email;
    }

    /**
     * Validate an email address
     * @param {string} email - The email to validate
     * @returns {boolean} True if email is valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if the form has at least one valid email
     */
    get isValid() {
        return this.emails.some(email => this.isValidEmail(email.trim()));
    }

    /**
     * Reset the form state
     */
    reset() {
        this.emails = [];
    }

    /**
     * Get all valid emails
     */
    get validEmails() {
        return this.emails.filter(email => this.isValidEmail(email.trim()));
    }
}

export default ShareFormStore;
