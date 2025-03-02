import { EVENTS } from '../../common/stores/storeEvents.js';
import { rootAncestorTownsStore } from '../../tabs/familyMap/stores/rootAncestorTownsStore.js';
import { infoWindowDisplayManager } from '../../tabs/familyMap/managers/infoWindowDisplayManager.js';
import { Offcanvas } from "bootstrap";
// test
export const mapTour = {
    event: EVENTS.VISUALIZATIONS.MAP.DRAWN,
    condition: (manager) => {
        const isFirstVisit = manager.isFirstVisit();
        const hasSeenTour = manager.hasTourBeenShown('mapView');
        return !isFirstVisit && !hasSeenTour;
    },
    steps: [
        {
            element: '#tab2-label', // step 1
            popover: {
                title: 'Calque des ancêtres',
                description: `
                    <div class="mb-4">
                        Activez ou désactivez l'affichage des lieux de naissance de vos ancêtres.
                    </div>
                    <div class="mb-2">Par défaut, la carte montre :</div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Les lieux de naissance</li>
                        <li>Le nombre d'ancêtres par lieu</li>
                        <li>Les lignées paternelles et maternelles</li>
                    </ul>
                `,
                position: 'right'
            },
        },
        {
            element: '#rootMarkerForTour', // step 2
            popover: {
                title: 'Marqueurs de lieux',
                description: `
                    <div class="mb-4">
                        Les marqueurs indiquent les lieux de naissance de vos ancêtres. La couleur des marqueurs vous permet d'identifier les lignées :
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #1e40af; margin-right: 8px;"></div>
                        <span>Lignée paternelle (côté père)</span>
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #be185d; margin-right: 8px;"></div>
                        <span>Lignée maternelle (côté mère)</span>
                    </div>
                    <div class="flex items-center mb-2">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #9333ea; margin-right: 8px;"></div>
                        <span>Lieu partagé par les deux lignées</span>
                    </div>
                `,
                position: 'bottom'
            },

        },
        {
            element: '#familyMap', // step 3
            popover: {
                title: 'Informations détaillées',
                description: `
                    <div class="mb-4">
                        En cliquant sur un marqueur, vous découvrirez :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Le nom du lieu</li>
                        <li>Le département</li>
                        <li>La liste des ancêtres nés dans ce lieu</li>
                        <li>Leur répartition par génération</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        Cliquez sur un marqueur pour essayer !
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async () => {
                try {
                    const markerElement = document.getElementById('rootMarkerForTour');
                    if (markerElement) {
                        const markers = rootAncestorTownsStore.markerDisplayManager.layers.get('rootAncestors');
                        if (markers && markers.size > 0) {
                            const firstMarker = Array.from(markers.values())[0];
                            if (firstMarker) {
                                // Accéder directement aux données stockées dans rootAncestorTownsStore
                                const locationData = rootAncestorTownsStore.birthData[0];
                                const content = rootAncestorTownsStore.createInfoWindowContent(
                                    locationData.location,
                                    [locationData],
                                    { [locationData.generation]: [locationData] }
                                );
                                infoWindowDisplayManager.showInfoWindow(firstMarker, content);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de l\'affichage de l\'info-window:', error);
                }
            },

        },
        {
            element: '#toolsButton',
            popover: {
                title: 'Paramètres de la carte',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage selon vos préférences :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Ajustez le nombre de générations affichées</li>
                        <li>Modifiez les couleurs des lignées</li>
                        <li>Changez le style d'affichage des noms</li>
                    </ul>
                    <div class="text-sm text-gray-600 italic">
                        Cliquez pour ouvrir le panneau des paramètres
                    </div>
                `,
                position: 'bottom'
            },
            onHighlight: async () => {
                // S'assurer que l'infoWindow est fermée avant d'afficher cette étape
                console.log('Fermeture de l\'info-window avant de passer à l\'étape suivante');
                infoWindowDisplayManager.initialize();
                console.log('Fermeture et réinitialisation effectuées');
            },
            onNextClick: async () => {
                console.log('Opening map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                    if (bsOffcanvas) {
                        new Offcanvas(offcanvas).show();
                    }
                }
            }
        },
        {
            element: '#layerControls', // step 5
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',

            },

            onHighlight: async () => {
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    new Offcanvas(offcanvas).show();
                }
            },

            /*
            onNextClick: async (element, step, { driver }) => {
                console.log('Closing map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                    if (bsOffcanvas) {
                        bsOffcanvas.hide();
                        await new Promise(resolve => {
                            offcanvas.addEventListener('hidden.bs.offcanvas', resolve, { once: true });
                        });
                    }
                }
            }
                */

        },
        {
            element: '#layerAncestorsContainer', // step 6
            popover: {
                title: 'Choix des villes à afficher',
                description: `
                    <div class="mb-4">
                        Personnalisez l'affichage des villes :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li>Filtrez par génération</li>
                        <li>Sélectionnez les types d'événements</li>
                        <li>Choisissez les lignées à afficher</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Combinez les filtres pour une vue personnalisée !
                    </div>
                `,
                position: 'right',
            },
        },
        // Étape 7 - Family Towns Layer
        {
            element: '#layerFamilyContainer',
            popover: {
                title: 'Carte complète de la famille',
                description: `
            <div class="mb-4">
                Ce calque affiche l'ensemble des lieux associés à votre arbre généalogique :
            </div>
            <ul class="list-disc pl-4 mb-4">
                <li>Tous les lieux de naissance, mariage et décès</li>
                <li>Vue globale de la dispersion géographique</li>
                <li>Explorez l'histoire complète de votre famille</li>
            </ul>
        `,
                position: 'right',
            },
            onHighlight: async () => {
                console.log('🔄 Préparation de l\'affichage du calque Family Towns...');

                // Capturer l'état initial des calques
                const initialState = {
                    ancestors: document.getElementById('layerAncestors')?.checked,
                    family: document.getElementById('layerFamily')?.checked,
                    surnames: document.getElementById('layerSurnames')?.checked
                };
                console.log('État initial des calques:', initialState);

                // Modifier les switchs d'interface
                const switchElements = {
                    ancestors: document.getElementById('layerAncestors'),
                    family: document.getElementById('layerFamily'),
                    surnames: document.getElementById('layerSurnames')
                };

                // 1. Désactiver d'abord tous les calques pour éviter les conflits visuels
                if (switchElements.ancestors && switchElements.ancestors.checked) {
                    switchElements.ancestors.checked = false;
                    switchElements.ancestors.dispatchEvent(new Event('change'));
                }

                if (switchElements.surnames && switchElements.surnames.checked) {
                    switchElements.surnames.checked = false;
                    switchElements.surnames.dispatchEvent(new Event('change'));
                }

                // 2. Attendre un peu que les désactivations soient prises en compte
                await new Promise(resolve => setTimeout(resolve, 300));

                // 3. Activer le calque Family Towns
                if (switchElements.family && !switchElements.family.checked) {
                    switchElements.family.checked = true;
                    switchElements.family.dispatchEvent(new Event('change'));
                    console.log('✅ Switch Family Towns activé');
                }

                // 4. Attendre que la mise à jour visuelle se produise
                await new Promise(resolve => setTimeout(resolve, 800));

                // 5. Vérifier l'état final
                console.log('État final des calques après configuration:', {
                    ancestors: document.getElementById('layerAncestors')?.checked,
                    family: document.getElementById('layerFamily')?.checked,
                    surnames: document.getElementById('layerSurnames')?.checked
                });
            }
        },

        // Étape 8 - Surnames Layer
        {
            element: '#layerSurnamesContainer',
            popover: {
                title: 'Filtrer par patronyme',
                description: `
            <div class="mb-4">
                Visualisez la répartition géographique d'un patronyme spécifique :
            </div>
            <ul class="list-disc pl-4 mb-4">
                <li>Sélectionnez un patronyme dans la liste déroulante</li>
                <li>Observez les lieux où ce patronyme est présent</li>
                <li>Analysez la concentration géographique des familles</li>
            </ul>
            <div class="text-sm text-blue-600">
                <strong>Astuce</strong> : Comparez différents patronymes pour identifier les régions d'origine !
            </div>
        `,
                position: 'right',
            },
            onHighlight: async () => {
                console.log('🔄 Préparation de l\'affichage du calque Surnames...');

                // Manipuler les switchs pour activer/désactiver les calques correspondants
                const switchElements = {
                    ancestors: document.getElementById('layerAncestors'),
                    family: document.getElementById('layerFamily'),
                    surnames: document.getElementById('layerSurnames')
                };

                // 1. Désactiver d'abord les autres calques
                if (switchElements.ancestors && switchElements.ancestors.checked) {
                    switchElements.ancestors.checked = false;
                    switchElements.ancestors.dispatchEvent(new Event('change'));
                }

                if (switchElements.family && switchElements.family.checked) {
                    switchElements.family.checked = false;
                    switchElements.family.dispatchEvent(new Event('change'));
                }

                // 2. Attendre un peu que les désactivations soient prises en compte
                await new Promise(resolve => setTimeout(resolve, 300));

                // 3. Activer le calque des patronymes
                if (switchElements.surnames && !switchElements.surnames.checked) {
                    switchElements.surnames.checked = true;
                    switchElements.surnames.dispatchEvent(new Event('change'));
                    console.log('✅ Switch Surnames activé');
                }

                // 4. Attendre que la mise à jour du switch soit prise en compte
                await new Promise(resolve => setTimeout(resolve, 400));

                // 5. Sélectionner un patronyme si le sélecteur est disponible
                const surnameFilter = document.getElementById('surnameFilter');
                if (surnameFilter) {
                    // Vérifier si la sélection est déjà active
                    if (surnameFilter.disabled) {
                        surnameFilter.disabled = false;
                    }

                    // Sélectionner le premier patronyme non vide si pas déjà sélectionné
                    if (surnameFilter.selectedIndex === 0 && surnameFilter.options.length > 1) {
                        surnameFilter.selectedIndex = 1;
                        surnameFilter.dispatchEvent(new Event('change'));
                        console.log('✅ Patronyme sélectionné:', surnameFilter.value);
                    }
                }

                // 6. Attendre que tout soit bien pris en compte
                await new Promise(resolve => setTimeout(resolve, 800));

                console.log('État final des calques après configuration:', {
                    ancestors: switchElements.ancestors?.checked,
                    family: switchElements.family?.checked,
                    surnames: switchElements.surnames?.checked,
                    surnameSelected: surnameFilter?.value
                });
            },
            onDeselected: async () => {
                console.log('Closing map parameters offcanvas...');
                const offcanvas = document.getElementById('mapParameters');
                if (offcanvas) {
                    try {
                        const bsOffcanvas = Offcanvas.getInstance(offcanvas);
                        if (bsOffcanvas) {
                            bsOffcanvas.hide();
                            await new Promise(resolve => {
                                offcanvas.addEventListener('hidden.bs.offcanvas', resolve, { once: true });
                            });
                        }
                    } catch (error) {
                        console.error("Erreur lors de la fermeture de l'offcanvas:", error);
                    }
                }

                // Restaurer l'état par défaut des calques (rootAncestorTowns activé)
                await new Promise(resolve => setTimeout(resolve, 300));

                try {
                    // Manipuler les switchs pour restaurer l'état initial
                    const switchElements = {
                        ancestors: document.getElementById('layerAncestors'),
                        family: document.getElementById('layerFamily'),
                        surnames: document.getElementById('layerSurnames')
                    };

                    // Désactiver d'abord tous les calques
                    if (switchElements.family && switchElements.family.checked) {
                        switchElements.family.checked = false;
                        switchElements.family.dispatchEvent(new Event('change'));
                    }

                    if (switchElements.surnames && switchElements.surnames.checked) {
                        switchElements.surnames.checked = false;
                        switchElements.surnames.dispatchEvent(new Event('change'));
                    }

                    // Attendre un peu que les désactivations soient prises en compte
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // Activer le calque des ancêtres
                    if (switchElements.ancestors && !switchElements.ancestors.checked) {
                        switchElements.ancestors.checked = true;
                        switchElements.ancestors.dispatchEvent(new Event('change'));
                    }

                    // Réinitialiser le sélecteur de patronymes
                    const surnameFilter = document.getElementById('surnameFilter');
                    if (surnameFilter) {
                        surnameFilter.selectedIndex = 0;
                        surnameFilter.disabled = true;
                    }

                    await new Promise(resolve => setTimeout(resolve, 300));

                    console.log('État final des calques après restauration:', {
                        ancestors: switchElements.ancestors?.checked,
                        family: switchElements.family?.checked,
                        surnames: switchElements.surnames?.checked
                    });
                } catch (error) {
                    console.error('Erreur lors de la restauration des calques:', error);
                }
            }
        },
        {
            element: '.gm-bundled-control',
            popover: {
                title: 'Navigation sur la carte',
                description: `
                    <div class="mb-4">
                        Pour explorer la carte :
                    </div>
                    <ul class="list-disc pl-4 mb-4">
                        <li><strong>Zoom</strong> : Utilisez les boutons + et - ou la molette de la souris</li>
                        <li><strong>Déplacement</strong> : Cliquez et faites glisser la carte</li>
                        <li><strong>Vue d'ensemble</strong> : Une mini-carte apparaît au zoom 9+</li>
                    </ul>
                    <div class="text-sm text-blue-600">
                        <strong>Astuce</strong> : Les marqueurs proches sont regroupés automatiquement. Zoomez pour les voir en détail !
                    </div>
                `,
                // Changer la position pour qu'elle soit au-dessus de l'ancre
                position: 'left'
            }
        }
    ]
};