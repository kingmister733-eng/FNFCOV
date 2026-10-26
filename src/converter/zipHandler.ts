import JSZip from 'jszip';
import {
  convertPsychToVSlice,
  convertVSliceToPsych,
  convertPsychCharacterToVSlice,
  convertPsychStageToVSlice,
} from './fnfConverter';

export interface ZipProcessingProgress {
  status: string;
  percent: number;
  filesFound: number;
  filesConverted: number;
}

export interface ZipConversionReport {
  success: boolean;
  error?: string;
  blob?: Blob;
  fileName: string;
  totalFiles: number;
  convertedCharts: string[];
  convertedCharacters: string[];
  convertedStages: string[];
  preservedAssets: string[];
  warnings: string[];
  repairs: string[];
}

export async function processModZip(
  file: File,
  direction: 'psych-to-vslice' | 'vslice-to-psych',
  targetDifficulty: string = 'normal',
  onProgress?: (progress: ZipProcessingProgress) => void
): Promise<ZipConversionReport> {
  const convertedCharts: string[] = [];
  const convertedCharacters: string[] = [];
  const convertedStages: string[] = [];
  const preservedAssets: string[] = [];
  const warnings: string[] = [];
  const repairs: string[] = [];

  try {
    if (onProgress) onProgress({ status: 'Reading ZIP archive...', percent: 10, filesFound: 0, filesConverted: 0 });

    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const outputZip = new JSZip();

    const fileEntries = Object.entries(contents.files).filter(([_, entry]) => !entry.dir);
    const totalFiles = fileEntries.length;

    let processed = 0;

    // Check for separate events.json if Psych
    let eventsJsonStr: string | undefined;
    for (const [path, entry] of fileEntries) {
      if (path.toLowerCase().endsWith('events.json')) {
        eventsJsonStr = await entry.async('string');
        break;
      }
    }

    for (const [path, entry] of fileEntries) {
      processed++;
      const lowerPath = path.toLowerCase();
      const fileName = path.split('/').pop() || path;

      if (onProgress) {
        onProgress({
          status: `Converting: ${fileName}`,
          percent: 15 + Math.round((processed / totalFiles) * 70),
          filesFound: totalFiles,
          filesConverted: convertedCharts.length + convertedCharacters.length + convertedStages.length,
        });
      }

      // 1. Chart JSON Files
      // Standard Psych paths: data/<song>/<song>.json or root <song>.json
      // Standard V-Slice paths: songs/<song>/<song>-chart.json
      if (
        (lowerPath.includes('data/') || lowerPath.includes('songs/') || !path.includes('/')) &&
        lowerPath.endsWith('.json') &&
        !lowerPath.endsWith('metadata.json') &&
        !lowerPath.endsWith('events.json') &&
        !lowerPath.includes('characters/') &&
        !lowerPath.includes('stages/') &&
        !lowerPath.includes('weeks/')
      ) {
        const text = await entry.async('string');
        try {
          if (direction === 'psych-to-vslice') {
            const result = convertPsychToVSlice(text, targetDifficulty, eventsJsonStr);
            if (result.success && result.chartJson && result.metadataJson) {
              const songId = (result.stats.player ? fileName.replace('.json', '') : 'converted_song').toLowerCase();
              outputZip.file(`songs/${songId}/${songId}-chart.json`, result.chartJson);
              outputZip.file(`songs/${songId}/${songId}-metadata.json`, result.metadataJson);
              convertedCharts.push(`${fileName} ➔ ${songId}-chart.json & metadata.json`);
              repairs.push(...result.repairs);
              warnings.push(...result.warnings);
              continue;
            }
          } else {
            // V-Slice to Psych
            const result = convertVSliceToPsych(text, undefined, targetDifficulty);
            if (result.success && result.chartJson) {
              const songId = fileName.replace(/-chart.*\.json$/, '').replace('.json', '');
              outputZip.file(`data/${songId}/${songId}.json`, result.chartJson);
              convertedCharts.push(`${fileName} ➔ data/${songId}/${songId}.json`);
              repairs.push(...result.repairs);
              warnings.push(...result.warnings);
              continue;
            }
          }
        } catch (e: any) {
          warnings.push(`Could not convert chart ${fileName}: ${e.message}`);
        }
      }

      // 2. Character JSON Files
      if (lowerPath.includes('characters/') && lowerPath.endsWith('.json')) {
        const text = await entry.async('string');
        try {
          const charName = fileName.replace('.json', '');
          if (direction === 'psych-to-vslice') {
            const vCharJson = convertPsychCharacterToVSlice(text, charName);
            outputZip.file(`characters/${charName}.json`, vCharJson);
            convertedCharacters.push(`character: ${charName}`);
          } else {
            // Keep Psych character as is or pass through
            outputZip.file(path, text);
            preservedAssets.push(path);
          }
          continue;
        } catch {
          warnings.push(`Character format fallback on ${fileName}`);
        }
      }

      // 3. Stage JSON Files
      if (lowerPath.includes('stages/') && lowerPath.endsWith('.json')) {
        const text = await entry.async('string');
        try {
          const stageName = fileName.replace('.json', '');
          if (direction === 'psych-to-vslice') {
            const vStageJson = convertPsychStageToVSlice(text, stageName);
            outputZip.file(`stages/${stageName}.json`, vStageJson);
            convertedStages.push(`stage: ${stageName}`);
          } else {
            outputZip.file(path, text);
            preservedAssets.push(path);
          }
          continue;
        } catch {
          warnings.push(`Stage format fallback on ${fileName}`);
        }
      }

      // 4. All other files: Audio (Inst.ogg, Voices.ogg), Spritesheets (.png, .xml), etc.
      // Copy over byte-by-byte into the output archive untouched
      const fileData = await entry.async('uint8array');
      outputZip.file(path, fileData);
      preservedAssets.push(path);
    }

    if (onProgress) onProgress({ status: 'Building converted ZIP package...', percent: 92, filesFound: totalFiles, filesConverted: totalFiles });

    const outputBlob = await outputZip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}_converted_${direction === 'psych-to-vslice' ? 'VSlice' : 'Psych'}.zip`;

    if (onProgress) onProgress({ status: 'Complete!', percent: 100, filesFound: totalFiles, filesConverted: totalFiles });

    return {
      success: true,
      blob: outputBlob,
      fileName: outName,
      totalFiles,
      convertedCharts,
      convertedCharacters,
      convertedStages,
      preservedAssets,
      warnings,
      repairs,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `ZIP conversion error: ${err.message}`,
      fileName: 'error.zip',
      totalFiles: 0,
      convertedCharts: [],
      convertedCharacters: [],
      convertedStages: [],
      preservedAssets: [],
      warnings: [],
      repairs: [],
    };
  }
}
