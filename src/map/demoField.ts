import { FieldMapMessage } from '../types/map';

// Demo field near Colombo; each block maps a plant so the backend can pick the AI model.
export const DEMO_FIELD: FieldMapMessage = {
  name: 'Field A',
  boundary: [
    [6.92700, 79.86100],
    [6.92700, 79.86230],
    [6.92790, 79.86230],
    [6.92790, 79.86100],
  ],
  blocks: [
    {
      id: 'block-a',
      name: 'Block A',
      plant: 'tomato',
      aiModel: 'tomato-disease-v1',
      color: '#22c55e',
      polygon: [
        [6.92705, 79.86105],
        [6.92705, 79.86160],
        [6.92785, 79.86160],
        [6.92785, 79.86105],
      ],
    },
    {
      id: 'block-b',
      name: 'Block B',
      plant: 'chili',
      aiModel: 'chili-disease-v1',
      color: '#f59e0b',
      polygon: [
        [6.92705, 79.86165],
        [6.92705, 79.86225],
        [6.92745, 79.86225],
        [6.92745, 79.86165],
      ],
    },
    {
      id: 'block-c',
      name: 'Block C',
      plant: 'brinjal',
      aiModel: 'brinjal-disease-v1',
      color: '#8b5cf6',
      polygon: [
        [6.92750, 79.86165],
        [6.92750, 79.86225],
        [6.92785, 79.86225],
        [6.92785, 79.86165],
      ],
    },
  ],
};
