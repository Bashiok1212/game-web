# -*- coding: utf-8 -*-
import os
out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'items')
os.makedirs(out_dir, exist_ok=True)
for n in range(1, 301):
    label = '道具' + str(n)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
           '<rect width="96" height="96" fill="#1a1a20" stroke="#2a2a35" stroke-width="2" rx="8"/>'
           '<text x="48" y="52" text-anchor="middle" fill="#e8e8ed" font-size="14" font-family="sans-serif">%s</text></svg>') % label
    with open(os.path.join(out_dir, str(n) + '.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
print('Generated 300 item images in', out_dir)
