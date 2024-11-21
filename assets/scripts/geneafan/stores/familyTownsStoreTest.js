import familyTownsStore from './familyTownsStore';

function testFamilyTownsStore() {
    console.clear();
    
    // Test 1: Ajout de villes
    console.log('=== Test 1: Ajout de villes ===');
    
    familyTownsStore.addTown('paris', {
        town: 'Paris',
        townDisplay: 'Paris (75)',
        departement: '75',
        country: 'France'
    });

    familyTownsStore.addTown('lyon', {
        town: 'Lyon',
        townDisplay: 'Lyon (69)',
        departement: '69',
        country: 'France'
    });

    console.log('Nombre de villes:', familyTownsStore.totalTowns);
    console.log('Données:', familyTownsStore.getAllTowns());

    // Test 2: Mise à jour
    console.log('\n=== Test 2: Mise à jour ===');
    
    familyTownsStore.updateTown('paris', {
        latitude: '48.8566',
        longitude: '2.3522'
    });

    console.log('Paris:', familyTownsStore.getTown('paris'));

    // Test 3: Persistence
    console.log('\n=== Test 3: Persistence ===');
    
    familyTownsStore.saveToLocalStorage();
    familyTownsStore.setTownsData({});
    console.log('Après effacement:', familyTownsStore.totalTowns);

    familyTownsStore.loadFromLocalStorage();
    console.log('Après rechargement:', familyTownsStore.totalTowns);
    console.log('Données finales:', familyTownsStore.getAllTowns());
}

// Ajouter le bouton de test
document.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.textContent = 'Test Store';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.onclick = testFamilyTownsStore;
    document.body.appendChild(button);
});

export { testFamilyTownsStore };