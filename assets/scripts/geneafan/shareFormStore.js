import { makeAutoObservable, reaction } from "mobx";

/**
 * The ShareFormStore is responsible for managing the entered emails and determining the validity of the form.
 */
class ShareFormStore {
  emails = [];
  isValid = false;

  constructor() {
    makeAutoObservable(this);

    reaction(
      () => this.emails.slice(),
      (emails) => {
        console.log("Emails mis à jour :", emails);

        // Filtrer les emails non vides
        const nonEmptyEmails = emails.filter(email => email && email.trim() !== '');

        // Vérifier s'il y a au moins un email valide
        const hasAtLeastOneValidEmail = nonEmptyEmails.some(email => this.isValidEmail(email));
        console.log("Au moins un email valide :", hasAtLeastOneValidEmail);

        // Vérifier si tous les emails non vides sont valides
        const allEmailsValid = nonEmptyEmails.every(email => this.isValidEmail(email));
        console.log("Tous les emails non vides sont valides :", allEmailsValid);

        // Mettre à jour la validité du formulaire
        this.isValid = hasAtLeastOneValidEmail && allEmailsValid;
        console.log("Le formulaire est valide :", this.isValid);
      }
    );
  }

  setEmail(index, email) {
    console.log(`Mise à jour de l'email à l'index ${index} :`, email);
    // Assurer que le tableau des emails est correctement dimensionné
    while (this.emails.length <= index) {
      this.emails.push('');
    }
    this.emails[index] = email;
  }

  getEmails() {
    return this.emails;
  }

  isValidEmail(email) {
    const emailRegex = /^(?!.*\.\.)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isValid = emailRegex.test(email);
    console.log(`Email "${email}" est valide :`, isValid);
    return isValid;
  }
}

export default ShareFormStore;
