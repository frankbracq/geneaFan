import { EVENTS } from '../../gedcom/stores/storeEvents.js';

export const welcomeTour = {
    event: EVENTS.ONBOARDING.APP_LOADED,
    condition: (manager) => manager.isFirstVisit(),
    steps: [
        {
            element: '#tab-nav',
            popover: {
                title: 'Navigation',
                description: 'Une fois votre fichier chargé, vous pourrez explorer vos données avec différentes visualisations.',
                position: 'bottom'
            }
        },
        {
            element: '#fileMenu',
            popover: {
                title: 'Bienvenue sur GeneaFan !',
                description: 'Pour commencer, vous devez charger un fichier GEDCOM. Cliquez ici pour importer votre fichier ou essayer notre exemple.',
                position: 'bottom'
            },
            onHighlight: (element) => {
                try {
                    // Déployer le menu déroulant à cette étape
                    setTimeout(() => {
                        if (element && !document.querySelector('.dropdown-menu.show')) {
                            console.log('Clicking on fileMenu to open the dropdown');
                            element.click();
                        }
                    }, 300);
                } catch (error) {
                    console.error('Error opening dropdown:', error);
                }
            }
        },
        {
            element: '#gedcomFileInput',
            popover: {
                title: 'Importez votre fichier GEDCOM',
                description: 'Vous pouvez charger votre propre fichier GEDCOM pour visualiser votre arbre généalogique.',
                position: 'bottom'
            },
            onHighlight: (element) => {
                try {
                    // S'assurer que le menu est ouvert
                    const fileMenuBtn = document.querySelector('#fileMenu');
                    if (fileMenuBtn && !document.querySelector('.dropdown-menu.show')) {
                        console.log('Clicking on fileMenu for gedcomFileInput step');
                        fileMenuBtn.click();
                    }
                } catch (error) {
                    console.error('Error ensuring dropdown is open:', error);
                }
            }
        },
        {
            element: '#myGedcomFiles',
            popover: {
                title: 'Mes fichiers GEDCOM',
                description: 'Accédez à vos fichiers GEDCOM précédemment sauvegardés (nécessite un compte).',
                position: 'bottom'
            },
            onHighlight: (element) => {
                try {
                    // S'assurer que le menu est ouvert
                    const fileMenuBtn = document.querySelector('#fileMenu');
                    if (fileMenuBtn && !document.querySelector('.dropdown-menu.show')) {
                        console.log('Clicking on fileMenu for myGedcomFiles step');
                        fileMenuBtn.click();
                    }
                } catch (error) {
                    console.error('Error ensuring dropdown is open:', error);
                }
            }
        },
        {
            element: '#gedcomFileSample',
            popover: {
                title: 'Fichier exemple',
                description: 'Pas de fichier GEDCOM ? Essayez notre exemple pour découvrir les fonctionnalités.',
                position: 'bottom'
            },
            onHighlight: (element) => {
                try {
                    // S'assurer que le menu est toujours ouvert
                    const fileMenuBtn = document.querySelector('#fileMenu');
                    if (fileMenuBtn && !document.querySelector('.dropdown-menu.show')) {
                        console.log('Clicking on fileMenu for gedcomFileSample step');
                        fileMenuBtn.click();
                    }
                } catch (error) {
                    console.error('Error ensuring dropdown is open:', error);
                }
            }
        },
        {
            element: '#pdf-export-options',
            popover: {
                title: 'Options d\'export PDF',
                description: 'Une fois votre arbre généalogique généré, vous pourrez l\'exporter en PDF avec ou sans filigrane.',
                position: 'right'
            },
            onHighlight: (element) => {
                try {
                    // S'assurer que le menu est toujours ouvert
                    const fileMenuBtn = document.querySelector('#fileMenu');
                    if (fileMenuBtn && !document.querySelector('.dropdown-menu.show')) {
                        console.log('Clicking on fileMenu for PDF export options step');
                        fileMenuBtn.click();
                    }
                } catch (error) {
                    console.error('Error ensuring dropdown is open:', error);
                }
            }
        }
    ]
};