import { getSourceData } from './state.js';  
import _ from 'lodash';  
import jsonpointer from 'jsonpointer'; 
import * as d3 from "d3";

export function loadFamilyAnimation() {
    if (document.querySelector("#familyAnimation svg")) {
        return;
    }

    const width = 960, height = 600;

    const svg = d3.select("#familyAnimation").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    console.log("SVG created", svg);

    const data = getSourceData();

    const nodes = [], links = [];
    const nodeMap = {};
    const rootId = "@I1@";

    const individuals = _.filter(data, { tag: "INDI" });

    individuals.forEach(individual => {
        const name = jsonpointer.get(individual, "/tree/0/data");
        nodes.push({ id: individual.pointer, name, x: width / 2, y: height / 2 });
        nodeMap[individual.pointer] = true;

        const familyPointers = _.filter(individual.tree, { tag: "FAMC" });
        familyPointers.forEach(familyPointer => {
            links.push({ source: individual.pointer, target: familyPointer.data });
        });
    });

    const validLinks = links.filter(link => nodeMap[link.target]);

    console.log("Nodes:", nodes);
    console.log("Links:", validLinks);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(validLinks).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(validLinks)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5);

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .attr("fill", "steelblue")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    console.log("SVG Nodes Created:", node);

    const label = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .attr("class", "label")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(d => d.name);

    console.log("SVG Labels Created:", label);

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => {
                console.log("Node x:", d.x);
                return d.x;
            })
            .attr("cy", d => {
                console.log("Node y:", d.y);
                return d.y;
            });

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

export function downloadSvg() {
    const svgElement = document.querySelector("#familyAnimation svg");
    if (!svgElement) {
        console.error("SVG element not found");
        return;
    }
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);

    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "family_tree.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}