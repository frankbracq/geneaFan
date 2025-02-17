import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';

class OnboardingManager {
    constructor() {
        this.driver = new Driver({
            animate: true,
            opacity: 0.7,
            padding: 5,
            showProgress: true,
            allowClose: true,
            stagePadding: 5,
            nextBtnText: 'Suivant',
            prevBtnText: 'Précédent',
            doneBtnText: 'Terminer',
            stageBackground: '#ffffff',
            popoverClass: 'geneafan-driver-popover',
            showButtons: ['next', 'previous', 'close'],
        });

        this.steps = [
            {
                element: '#gedcomMenu',
                popover: {
                    title: 'Importer votre GEDCOM',
                    description: 'Commencez par importer votre fichier GEDCOM ou essayez avec notre fichier exemple.',
                    position: 'bottom'
                }
            },
            {
                element: '#individual-select',
                popover: {
                    title: 'Sélection de l\'individu',
                    description: 'Recherchez et sélectionnez un individu pour afficher son arbre généalogique.',
                    position: 'bottom'
                }
            },
            {
                element: '#tab-nav',
                popover: {
                    title: 'Différentes vues',
                    description: 'Explorez votre généalogie avec différentes visualisations : éventail, carte, arbre, chronologie et statistiques.',
                    position: 'bottom'
                }
            },
            {
                element: '#fanParametersDisplay',
                popover: {
                    title: 'Paramètres',
                    description: 'Personnalisez l\'affichage selon vos préférences.',
                    position: 'right'
                }
            },
            {
                element: '#download-menu',
                popover: {
                    title: 'Exportation',
                    description: 'Téléchargez votre arbre dans différents formats (PDF, SVG, PNG).',
                    position: 'left'
                }
            }
        ];
    }

    initialize() {
        // Vérifie si c'est la première visite
        if (this.isFirstVisit()) {
            this.startTour();
        }

        // Ajoute un bouton pour relancer le tour
        this.addRestartButton();
    }

    startTour() {
        this.driver.defineSteps(this.steps);
        this.driver.start();
    }

    isFirstVisit() {
        const hasSeenTour = localStorage.getItem('geneafan_has_seen_tour');
        if (!hasSeenTour) {
            localStorage.setItem('geneafan_has_seen_tour', 'true');
            return true;
        }
        return false;
    }

    addRestartButton() {
        // Ajoute un bouton discret pour relancer le tour
        const button = document.createElement('button');
        button.innerHTML = '?';
        button.className = 'tour-restart-btn';
        button.title = 'Relancer le tour';
        button.onclick = () => this.startTour();
        document.body.appendChild(button);
    }
}

// Styles pour le tour
const style = document.createElement('style');
style.textContent = `
    .geneafan-driver-popover {
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    }

    .tour-restart-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #007bff;
        color: white;
        border: none;
        cursor: pointer;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s;
    }

    .tour-restart-btn:hover {
        opacity: 1;
    }
`;
document.head.appendChild(style);

export default OnboardingManager; 