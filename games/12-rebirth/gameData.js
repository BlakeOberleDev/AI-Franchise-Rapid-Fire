import { mechanics } from './gameOverrides.js';

export default {
  id: 12,
  mechanics,
  title: 'Rebirth',
  party: [
    { name: 'Kael', color: '#dc7a55', range: false },
    { name: 'Lyra', color: '#70d2d0', range: true },
    { name: 'Bram', color: '#b48b61', range: false },
    { name: 'Wren', color: '#84ad70', range: true }
  ],
  regions: [
    {
      name: 'The Floating Crossroads',
      enemy: 'Shattered Shade',
      crystals: [],
      scrolls: [{ x: 180, y: 170 }, { x: 760, y: 380 }],
      puzzle: {
        type: 'plates',
        title: 'Anchor the floating gate',
        points: [{ x: 320, y: 140, name: 'North plate' }, { x: 610, y: 390, name: 'South plate' }]
      }
    },
    {
      name: 'Cinder-Spire Ruins',
      enemy: 'Cinder Sentinel',
      crystals: [{ x: 480, y: 170 }, { x: 680, y: 330 }],
      scrolls: [{ x: 270, y: 390 }],
      puzzle: {
        type: 'mirrors',
        title: 'Reflect the fire beam',
        target: [2, 1],
        points: [{ x: 350, y: 180, name: 'West mirror' }, { x: 610, y: 250, name: 'East mirror' }]
      }
    },
    {
      name: 'Sunken Sky-Falls',
      enemy: 'Tide Echo',
      crystals: [{ x: 470, y: 250 }, { x: 760, y: 160 }],
      scrolls: [{ x: 250, y: 140 }],
      puzzle: {
        type: 'sequence',
        title: 'Restore the water flow',
        sequence: [2, 0, 1],
        points: [
          { x: 330, y: 150, name: 'Upper valve' },
          { x: 520, y: 360, name: 'West valve' },
          { x: 740, y: 300, name: 'East valve' }
        ]
      }
    },
    {
      name: 'Crag-Heart & Gale-Sanctum',
      enemy: 'Storm Colossus',
      crystals: [{ x: 410, y: 140 }, { x: 610, y: 350 }, { x: 760, y: 160 }],
      scrolls: [{ x: 170, y: 380 }, { x: 620, y: 110 }],
      puzzle: {
        type: 'switches',
        title: 'Raise the sky-bridge',
        requiredLeader: 'Wren',
        points: [{ x: 360, y: 320, name: 'Anchor switch' }, { x: 690, y: 220, name: 'Grapple switch' }]
      }
    },
    {
      name: 'The Fractured Depths',
      enemy: 'Void-Echo Sentinel',
      crystals: [{ x: 480, y: 270 }],
      scrolls: [{ x: 190, y: 220 }, { x: 780, y: 420 }],
      puzzle: {
        type: 'attunement',
        title: 'Attune the paired sanctums',
        requiredLeaders: ['Lyra', 'Kael'],
        points: [{ x: 350, y: 145, name: 'Light sanctum' }, { x: 350, y: 395, name: 'Dark sanctum' }]
      }
    }
  ]
};
