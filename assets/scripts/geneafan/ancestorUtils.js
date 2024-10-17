import _ from 'lodash';
import { getAncestorMapCache, setAncestorMapCache, getGenealogyGraph, setCommonAncestryGraphData } from './stores/state';

// Create a map for quick ancestor lookup
// This function is only called if the map is not already cached
function createAncestorMap(edges) {
    const ancestorMap = new Map();
    edges.forEach(edge => {
        if (!ancestorMap.has(edge.target)) {
            ancestorMap.set(edge.target, {});
        }
        if (edge.relation === "father") {
            ancestorMap.get(edge.target).fid = edge.source;
        } else if (edge.relation === "mother") {
            ancestorMap.get(edge.target).mid = edge.source;
        }
    });
    return ancestorMap;
}

// Helper function to trace ancestors using the ancestor map
function traceAncestors(id, ancestorMap) {
    let ancestors = [];
    let queue = [id];
    let visited = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!visited.has(currentId)) {
            visited.add(currentId);
            ancestors.push(currentId);
            const parents = ancestorMap.get(currentId) || {};
            if (parents.fid) queue.push(parents.fid);
            if (parents.mid) queue.push(parents.mid);
        }
    }

    return ancestors;
}

// Function to get the oldest ancestor (= root in FamilyTreeJS) of a node using ancestorMap
export function getOldestAncestorOf(individualId, prioritize = "both") {
    let ancestorMap = getAncestorMapCache();
    if (ancestorMap.size === 0) {
        const genealogyGraph = getGenealogyGraph();
        ancestorMap = createAncestorMap(genealogyGraph.edges);
        setAncestorMapCache(ancestorMap);
    }
    
    let currentId = individualId;
    let queue = [currentId];
    let visited = new Set();
    let oldestAncestor = currentId;

    while (!_.isEmpty(queue)) {
        currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const parents = ancestorMap.get(currentId);
        if (!parents) continue;

        // Utilisation de lodash pour ajouter les parents à la file d'attente
        switch (prioritize) {
            case 'father':
                if (parents.fid) queue.push(parents.fid);
                break;
            case 'mother':
                if (parents.mid) queue.push(parents.mid);
                break;
            case 'both':
                _.forEach(['fid', 'mid'], parentType => {
                    if (parents[parentType]) queue.push(parents[parentType]);
                });
                break;
        }

        oldestAncestor = currentId;
    }
    return oldestAncestor;
}

// Function to find the closest common ancestor
function closestAncestor(graph, id1, id2) {
    let ancestorMap = getAncestorMapCache();
    if (ancestorMap.size === 0) {
        ancestorMap = createAncestorMap(graph.edges);
        setAncestorMapCache(ancestorMap);
    }

    const ancestors1 = new Set(traceAncestors(id1, ancestorMap));
    const ancestors2 = new Set(traceAncestors(id2, ancestorMap));

    for (let ancestor of ancestors1) {
        if (ancestors2.has(ancestor)) {
            return ancestor;
        }
    }
    return null;
}

// Function to trace the shortest path using BFS
function shortestPath(graph, start, end) {
    const adjacencyList = new Map();
    graph.edges.forEach(edge => {
        if (!adjacencyList.has(edge.source)) {
            adjacencyList.set(edge.source, []);
        }
        adjacencyList.get(edge.source).push(edge.target);
    });

    let queue = [start];
    let visited = new Set();
    let parentMap = new Map(); // Pour reconstruire le chemin

    while (queue.length > 0) {
        let current = queue.shift();
        if (current === end) {
            let path = [];
            while (current !== start) {
                path.unshift(current);
                current = parentMap.get(current);
            }
            path.unshift(start); // Ajouter le point de départ au début du chemin
            return path; // Retourner le chemin dès que la cible est atteinte
        }
        visited.add(current);

        const neighbors = adjacencyList.get(current) || [];
        for (let neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
                parentMap.set(neighbor, current); // Enregistrer le parent
            }
        }
    }
    
    return null; // Retourner null si aucun chemin n'est trouvé
}

// Function to find the common ancestry graph
export function commonAncestryGraph(id1, id2) {
    console.time('commonAncestryGraph');
    const graph = getGenealogyGraph();
    let commonAncestorId = closestAncestor(graph, id1, id2);
    if (!commonAncestorId) {
        console.log('No ancestors found for ' + id1 + ' ' + id2);
        return null;
    } else {
        console.log('Closest ancestor is ' + graph.nodes.find(node => node.id === commonAncestorId).name + ' with id ' + commonAncestorId);
    }

    let edges1 = shortestPath(graph, commonAncestorId, id1);
    let edges2 = shortestPath(graph, commonAncestorId, id2);
    let commonAncestryGraph = _.union(edges1, edges2);
    setCommonAncestryGraphData(commonAncestryGraph);
    console.timeEnd('commonAncestryGraph');
    return [...edges1, ...edges2];
}
