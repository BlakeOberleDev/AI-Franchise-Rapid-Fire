const CAMPAIGNS={
  1:{patterns:['escort','flank','split','escort','boss'],formations:['column','flank','split','column','split'],scales:[.9,1,1.08,1.15,1.2]},
  2:{patterns:['push','split','flank','elite','boss'],formations:['column','split','flank','split','column'],scales:[.9,1,1.08,1.18,1.28]},
  3:{patterns:['split','flank','push','elite','boss'],formations:['split','flank','column','split','flank'],scales:[.85,.95,1.05,1.12,1.25]},
  4:{patterns:['split','push','flank','elite','boss'],formations:['split','column','flank','split','flank'],scales:[.9,1,1.05,1.18,1.3]},
  5:{patterns:['push','split','elite','flank','boss'],formations:['column','split','column','flank','split'],scales:[.9,.98,1.12,1.15,1.32]},
  6:{patterns:['flank','push','split','elite','boss'],formations:['flank','column','split','flank','column'],scales:[1,1.02,1.1,1.2,1.35]},
  7:{patterns:['escort','split','flank','push','boss'],formations:['column','split','flank','column','flank'],scales:[.88,.98,1.08,1.2,1.35]},
  8:{patterns:['push','flank','split','elite','boss'],formations:['column','flank','split','flank','split'],scales:[1,1.05,1.1,1.22,1.38]},
  9:{patterns:['split','push','flank','elite','boss'],formations:['split','column','flank','split','column'],scales:[.92,1.02,1.12,1.22,1.38]},
  10:{patterns:['flank','split','push','elite','boss'],formations:['flank','split','column','split','flank'],scales:[.92,1.04,1.14,1.24,1.42]},
  11:{patterns:['split','flank','elite','push','boss'],formations:['split','flank','column','split','flank'],scales:[.95,1.05,1.15,1.28,1.45]},
  13:{patterns:['push','split','flank','elite','boss'],formations:['column','split','flank','split','flank'],scales:[1,1.08,1.2,1.32,1.55]}
};

const STAGE_MODIFIERS=[
  {offset:0,extra:0}, {offset:1,extra:1}, {offset:2,extra:0},
  {offset:3,extra:1}, {offset:4,extra:2}, {offset:1,extra:2}
];

export function getWaveScript(gameId,stageIndex,waveIndex,stage,enemies) {
  const campaign=CAMPAIGNS[gameId]||CAMPAIGNS[13];
  const modifier=STAGE_MODIFIERS[stageIndex%STAGE_MODIFIERS.length];
  const patternIndex=(waveIndex+modifier.offset)%campaign.patterns.length;
  const pattern=campaign.patterns[patternIndex];
  const roster=enemies||[];
  const elites=waveIndex>=2&&roster.length>2
    ?[roster[(stageIndex+waveIndex+modifier.offset)%roster.length]]
    :[];
  const objectives={
    escort:'Protect the evacuees while the convoy crosses the field.',
    push:'Intercept the advancing enemy column before it reaches your line.',
    split:'Cover both lanes; the enemy is attacking from divided fronts.',
    flank:'Watch the western approach and protect your back line.',
    elite:'Break the elite guard before the next assault arrives.',
    boss:'Survive the climax and defeat the campaign boss.'
  };
  return {
    pattern,
    formation:campaign.formations[patternIndex],
    count:5+waveIndex*2+(stage.difficulty||1)+modifier.extra,
    hpScale:campaign.scales[patternIndex]+stageIndex*.035,
    elites,
    eliteHp:1.55+stageIndex*.08,
    objective:objectives[pattern]||'Hold the line and adapt to the next wave.',
    boss:waveIndex===4
  };
}
