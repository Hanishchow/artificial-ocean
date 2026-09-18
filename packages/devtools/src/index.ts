export interface TrajectoryPlotOptions { width?: number; height?: number; title?: string; }
export interface Silhouette { positions: Float32Array; label?: string; }
export interface ContactSheetCell { id: string; trajectory: Float32Array; frames: Silhouette[]; caption?: string; ok: boolean; }

function fmt(v: number): string {
	return (Math.round(v * 100) / 100).toFixed(2);
}

export function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function trajectorySvg(trajectory: Float32Array, opts?: TrajectoryPlotOptions): string {
	const w = opts?.width ?? 800;
	const h = opts?.height ?? 600;
	const title = opts?.title;

	const n = trajectory.length / 3;
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (let i = 0; i < n; i++) {
		const x = trajectory[3 * i];
		const y = trajectory[3 * i + 1];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const bboxW = maxX - minX;
	const bboxH = maxY - minY;
	const margin = 0.1 * Math.min(w, h);

	const scaleX = bboxW === 0 ? Infinity : (w - 2 * margin) / bboxW;
	const scaleY = bboxH === 0 ? Infinity : (h - 2 * margin) / bboxH;
	// Both degenerate means a single point; any finite scale will do.
	const scale = Math.min(scaleX, scaleY) === Infinity ? 1 : Math.min(scaleX, scaleY);

	const tx = margin + (w - 2 * margin - bboxW * scale) / 2;
	const ty = margin + (h - 2 * margin - bboxH * scale) / 2;

	// Project 3D to 2D: drop Z, flip Y (world Y up → SVG Y down)
	// sx = x * scale + tx - minX * scale
	// sy = (maxY - y) * scale + ty

	function proj(x: number, y: number): string {
		const sx = x * scale + tx - minX * scale;
		const sy = (maxY - y) * scale + ty;
		return `${fmt(sx)},${fmt(sy)}`;
	}

	let d = "";
	for (let i = 0; i < n; i++) {
		const p = proj(trajectory[3 * i], trajectory[3 * i + 1]);
		d += (i === 0 ? "M" : "L") + p;
	}

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
	svg += `<rect width="${w}" height="${h}" fill="#0a0a12"/>`;
	if (title) {
		svg += `<text x="${fmt(w / 2)}" y="20" text-anchor="middle" fill="#cccccc" font-size="14" font-family="sans-serif">${escapeXml(title)}</text>`;
	}
	svg += `<path d="${d}" fill="none" stroke="#00d4ff" stroke-width="1.5"/>`;

	if (n > 0) {
		const sp = proj(trajectory[0], trajectory[1]);
		svg += `<circle cx="${sp.split(",")[0]}" cy="${sp.split(",")[1]}" r="3" fill="#00d4ff"/>`;
	}
	if (n > 1) {
		const ep = proj(trajectory[3 * (n - 1)], trajectory[3 * (n - 1) + 1]);
		svg += `<circle cx="${ep.split(",")[0]}" cy="${ep.split(",")[1]}" r="5" fill="#00d4ff"/>`;
	}

	svg += "</svg>";
	return svg;
}

export function silhouetteSvg(s: Silhouette, size?: number): string {
	const sz = size ?? 400;
	const pos = s.positions;
	const n = pos.length / 3;

	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	for (let i = 0; i < n; i++) {
		const x = pos[3 * i];
		const y = pos[3 * i + 1];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const bboxW = maxX - minX;
	const bboxH = maxY - minY;
	const margin = 0.1 * sz;

	const scaleX = bboxW === 0 ? Infinity : (sz - 2 * margin) / bboxW;
	const scaleY = bboxH === 0 ? Infinity : (sz - 2 * margin) / bboxH;
	const scale = Math.min(scaleX, scaleY) === Infinity ? 1 : Math.min(scaleX, scaleY);

	const tx = margin + (sz - 2 * margin - bboxW * scale) / 2;
	const ty = margin + (sz - 2 * margin - bboxH * scale) / 2;

	function proj(x: number, y: number): string {
		const sx = x * scale + tx - minX * scale;
		const sy = (maxY - y) * scale + ty;
		return `${fmt(sx)},${fmt(sy)}`;
	}

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">`;
	svg += `<rect width="${sz}" height="${sz}" fill="#0a0a12"/>`;

	for (let i = 0; i < n; i++) {
		const p = proj(pos[3 * i], pos[3 * i + 1]);
		const [cx, cy] = p.split(",");
		svg += `<circle cx="${cx}" cy="${cy}" r="1.2" fill="#00d4ff"/>`;
	}

	if (s.label) {
		svg += `<text x="${fmt(margin)}" y="${fmt(sz - margin)}" fill="#cccccc" font-size="12" font-family="sans-serif">${escapeXml(s.label)}</text>`;
	}

	svg += "</svg>";
	return svg;
}

export function contactSheetSvg(cells: ContactSheetCell[], columns?: number): string {
	const cols = columns ?? 10;
	const cellW = 200;
	const cellH = 250;
	const gap = 10;
	const rows = Math.ceil(cells.length / cols);
	const svgW = cols * (cellW + gap) + gap;
	const svgH = rows * (cellH + gap) + gap;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
	svg += `<rect width="${svgW}" height="${svgH}" fill="#0a0a12"/>`;

	for (let c = 0; c < cells.length; c++) {
		const cell = cells[c];
		const col = c % cols;
		const row = Math.floor(c / cols);
		const cx = gap + col * (cellW + gap);
		const cy = gap + row * (cellH + gap);

		const borderColor = cell.ok ? "#555555" : "#ff4444";

		svg += `<g transform="translate(${cx},${cy})">`;
		svg += `<rect width="${cellW}" height="${cellH}" fill="#0a0a12" stroke="${borderColor}" stroke-width="2"/>`;

		const tMargin = 8;
		const tW = cellW - 2 * tMargin;
		const tH = 140;

		const traj = cell.trajectory;
		const tN = traj.length / 3;

		if (tN > 0) {
			let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
			for (let i = 0; i < tN; i++) {
				const x = traj[3 * i];
				const y = traj[3 * i + 1];
				if (x < tMinX) tMinX = x;
				if (x > tMaxX) tMaxX = x;
				if (y < tMinY) tMinY = y;
				if (y > tMaxY) tMaxY = y;
			}

			const tBboxW = tMaxX - tMinX;
			const tBboxH = tMaxY - tMinY;
			const tScaleX = tBboxW === 0 ? Infinity : tW / tBboxW;
			const tScaleY = tBboxH === 0 ? Infinity : tH / tBboxH;
			const tScale = Math.min(tScaleX, tScaleY) === Infinity ? 1 : Math.min(tScaleX, tScaleY);
			const tTx = tMargin + (tW - tBboxW * tScale) / 2;
			const tTy = tMargin + (tH - tBboxH * tScale) / 2;

			function tProj(x: number, y: number): string {
				const sx = x * tScale + tTx - tMinX * tScale;
				const sy = (tMaxY - y) * tScale + tTy;
				return `${fmt(sx)},${fmt(sy)}`;
			}

			let d = "";
			for (let i = 0; i < tN; i++) {
				const p = tProj(traj[3 * i], traj[3 * i + 1]);
				d += (i === 0 ? "M" : "L") + p;
			}
			svg += `<path d="${d}" fill="none" stroke="#00d4ff" stroke-width="1"/>`;

			if (tN > 0) {
				const sp = tProj(traj[0], traj[1]);
				const [spx, spy] = sp.split(",");
				svg += `<circle cx="${spx}" cy="${spy}" r="2" fill="#00d4ff"/>`;
			}
			if (tN > 1) {
				const ep = tProj(traj[3 * (tN - 1)], traj[3 * (tN - 1) + 1]);
				const [epx, epy] = ep.split(",");
				svg += `<circle cx="${epx}" cy="${epy}" r="3" fill="#00d4ff"/>`;
			}
		}

		// Draw frames side by side beneath the trajectory
		const frameAreaY = 150;
		const frameSize = 30;
		const frameGap = 4;
		const maxFrames = Math.floor((cellW - 2 * tMargin) / (frameSize + frameGap));
		let fIdx = 0;
		for (const frame of cell.frames) {
			if (fIdx >= maxFrames) break;
			const fOx = tMargin + (fIdx % maxFrames) * (frameSize + frameGap);
			const fOy = frameAreaY + Math.floor(fIdx / maxFrames) * (frameSize + frameGap);

			const fPos = frame.positions;
			const fN = fPos.length / 3;
			if (fN === 0) { fIdx++; continue; }

			let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
			for (let i = 0; i < fN; i++) {
				const x = fPos[3 * i];
				const y = fPos[3 * i + 1];
				if (x < fMinX) fMinX = x;
				if (x > fMaxX) fMaxX = x;
				if (y < fMinY) fMinY = y;
				if (y > fMaxY) fMaxY = y;
			}

			const fBboxW = fMaxX - fMinX;
			const fBboxH = fMaxY - fMinY;
			const fScaleX = fBboxW === 0 ? 1 : (frameSize - 4) / fBboxW;
			const fScaleY = fBboxH === 0 ? 1 : (frameSize - 4) / fBboxH;
			const fScale = Math.min(fScaleX, fScaleY);
			const fTx = fOx + 2 + (frameSize - 4 - fBboxW * fScale) / 2;
			const fTy = fOy + 2 + (frameSize - 4 - fBboxH * fScale) / 2;

			for (let i = 0; i < fN; i++) {
				const sx = fPos[3 * i] * fScale + fTx - fMinX * fScale;
				const sy = (fMaxY - fPos[3 * i + 1]) * fScale + fTy;
				svg += `<circle cx="${fmt(sx)}" cy="${fmt(sy)}" r="1.2" fill="#00d4ff"/>`;
			}

			if (frame.label) {
				svg += `<text x="${fmt(fOx)}" y="${fmt(fOy + frameSize + 10)}" fill="#888888" font-size="8" font-family="sans-serif">${escapeXml(frame.label)}</text>`;
			}

			fIdx++;
		}

		const label = cell.caption ?? cell.id;
		if (label) {
			svg += `<text x="${fmt(tMargin)}" y="${fmt(cellH - 8)}" fill="#cccccc" font-size="10" font-family="sans-serif">${escapeXml(label)}</text>`;
		}

		svg += "</g>";
	}

	svg += "</svg>";
	return svg;
}
