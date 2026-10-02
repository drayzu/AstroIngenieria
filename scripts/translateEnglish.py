"""Offline translation authoring; outputs are reviewed and shipped as static content.

Run after `node scripts/generateEnglish.mjs --extract` with CTranslate2 and
SentencePiece available. Model path can be supplied with --model.
"""
import argparse
import json
import re
import sys
import os
import ctypes
from pathlib import Path

sys.path.insert(0, str(Path('tmp/translation-python').resolve()))
import ctranslate2
import sentencepiece

parser = argparse.ArgumentParser()
parser.add_argument('--model', default='tmp/translation-model/opus-es-en')
parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'])
args = parser.parse_args()
model = Path(args.model)
source = sentencepiece.SentencePieceProcessor(model_file=str(model / 'source.spm'))
target = sentencepiece.SentencePieceProcessor(model_file=str(model / 'target.spm'))
if args.device == 'cuda':
    dll_path = Path('tmp/translation-python/nvidia/cublas/bin').resolve()
    os.environ['PATH'] = str(dll_path) + os.pathsep + os.environ['PATH']
    dll_handles = [ctypes.WinDLL(str(dll_path / name)) for name in ['cublasLt64_12.dll', 'cublas64_12.dll']]
translator = ctranslate2.Translator(str(model), device=args.device, compute_type='float32' if args.device == 'cuda' else 'int8', intra_threads=4)

glossary = {
    'technofirms': 'technosignatures', 'technofirm': 'technosignature',
    'technosigns': 'technosignatures', 'technosign': 'technosignature',
    'astroengineering': 'astroengineering', 'astro-engineering': 'astroengineering',
    'Dyson flock': 'Dyson swarm', 'Dyson swarm': 'Dyson swarm',
    'heat evacuation': 'heat rejection', 'radiators': 'radiators',
    'habitability': 'habitability', 'Matrioshka': 'Matrioshka',
}

domain_terms = {
    'miles de millones': 'billions', 'billones': 'trillions',
    'julios': 'joules', 'julio': 'joule',
    'tecnofirmas': 'technosignatures', 'tecnofirma': 'technosignature',
    'velas solares': 'solar sails', 'vela solar': 'solar sail',
    'velas láser': 'laser sails', 'vela láser': 'laser sail',
    'velas magnéticas': 'magnetic sails', 'vela magnética': 'magnetic sail',
    'velas eléctricas': 'electric sails', 'vela eléctrica': 'electric sail',
    'toro de Stanford': 'Stanford torus', 'toros': 'tori', 'toro': 'torus',
    'terraformación': 'terraforming', 'paraterraformación': 'paraterraforming',
    'calor residual': 'waste heat', 'tiempo propio': 'proper time',
    'zona habitable': 'habitable zone', 'computronium': 'computronium',
    'propulsión de fusión': 'fusion propulsion',
}

def prepare(text):
    for old, new in domain_terms.items():
        text = re.sub(r'\b' + re.escape(old) + r'\b', new, text, flags=re.IGNORECASE)
    return text

def sentences(text):
    return re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡“«\[])', text.strip())

def polish(text, original):
    for old, new in glossary.items():
        text = re.sub(r'\b' + re.escape(old) + r'\b', new, text, flags=re.IGNORECASE) if old.lower() != new.lower() else text
    for old, new in [('Julys', 'joules'), ('Julius', 'joules'), ('terraformation', 'terraforming'), ('paraterraformation', 'paraterraforming'), ('catchers', 'collectors'), ('computonium', 'computronium')]:
        text = re.sub(r'\b' + old + r'\b', new, text, flags=re.IGNORECASE)
    if re.search(r'\bvelas?\b', original, re.IGNORECASE):
        text = re.sub(r'\bcandles\b', 'sails', text, flags=re.IGNORECASE)
        text = re.sub(r'\bcandle\b', 'sail', text, flags=re.IGNORECASE)
    text = text.replace('’', "'").replace('O’Neill', "O'Neill")
    # References stay attached to the same sentence even if the MT model drops one.
    refs = re.findall(r'\[\d+\]', original)
    if re.findall(r'\[\d+\]', text) != refs:
        text = re.sub(r'\s*\[\d+\]', '', text).rstrip() + (' ' + ' '.join(refs) if refs else '')
    return text.strip()

files = sorted(Path('tmp/english-authoring').glob('*.input.json'))
for file_index, filename in enumerate(files):
    data = json.loads(filename.read_text(encoding='utf-8'))
    output = filename.with_name(filename.name.replace('.input.json', '.json'))
    source_json = json.dumps(data['slots'], ensure_ascii=False, separators=(',', ':'))
    if output.exists():
        saved = json.loads(output.read_text(encoding='utf-8'))
        if saved.get('version') == 3 and json.loads(saved['source']) == data['slots']:
            continue
    strings = [slot['text'] for slot in data['slots']]
    pieces = [sentences(text) for text in strings]
    flat = [sentence for group in pieces for sentence in group]
    translated = []
    for start in range(0, len(flat), 24):
        batch = flat[start:start+24]
        tokens = [source.encode(prepare(text), out_type=str) + ['</s>'] for text in batch]
        results = translator.translate_batch(tokens, beam_size=4, max_decoding_length=512, max_input_length=512, repetition_penalty=1.05)
        translated.extend(polish(target.decode(item.hypotheses[0]), original) for item, original in zip(results, batch))
    result = []
    cursor = 0
    for group in pieces:
        result.append(' '.join(translated[cursor:cursor+len(group)]))
        cursor += len(group)
    assert len(result) == len(strings)
    output.write_text(json.dumps({'source': source_json, 'result': result, 'version': 3}, ensure_ascii=False), encoding='utf-8')
    print(f'{file_index+1}/{len(files)} {data["label"]}', flush=True)
