// Helper dictionary to assign accurate ecological traits based on bird families/orders & species taxonomy
export interface EcologicalTraits {
  guild: string;
  habitat: string;
  foraging_stratum: string;
  vocal_activity: 'High' | 'Moderate' | 'Low';
  endemic_status: 'Yes' | 'No';
}

export function getEcologicalTraits(scientificName: string, commonName: string): EcologicalTraits {
  const name = (scientificName + ' ' + commonName).toLowerCase();

  if (name.includes('sunbird') || name.includes('flowerpecker')) {
    return {
      guild: 'Nectarivore / Insectivore',
      habitat: 'Canopy edges, flowering gardens, tropical forests',
      foraging_stratum: 'Upper Canopy & Midstory',
      vocal_activity: 'High',
      endemic_status: 'No'
    };
  }

  if (name.includes('drongo')) {
    return {
      guild: 'Insectivore (Aerial Sallier)',
      habitat: 'Open forests, plantations, forest clearings',
      foraging_stratum: 'Aerial / High Canopy',
      vocal_activity: 'High',
      endemic_status: name.includes('andaman') ? 'Yes' : 'No'
    };
  }

  if (name.includes('pitta')) {
    return {
      guild: 'Insectivore (Ground Gleaner)',
      habitat: 'Dense evergreen forest understory & bamboo thickets',
      foraging_stratum: 'Forest Floor / Understory',
      vocal_activity: 'Moderate',
      endemic_status: 'No'
    };
  }

  if (name.includes('hornbill')) {
    return {
      guild: 'Frugivore / Large Seed Disperser',
      habitat: 'Primary evergreen & semi-evergreen rainforests',
      foraging_stratum: 'Emergent Upper Canopy',
      vocal_activity: 'High',
      endemic_status: name.includes('malabar') || name.includes('narcondam') ? 'Yes' : 'No'
    };
  }

  if (name.includes('owl') || name.includes('eagle') || name.includes('falcon') || name.includes('hawk') || name.includes('harrier') || name.includes('kestrel')) {
    return {
      guild: 'Apex Carnivore / Predator',
      habitat: 'Woodlands, grasslands, river valleys',
      foraging_stratum: 'Aerial / Perch-and-pounce',
      vocal_activity: 'Moderate',
      endemic_status: 'No'
    };
  }

  if (name.includes('woodpecker') || name.includes('flameback')) {
    return {
      guild: 'Insectivore (Wood-boring Specialist)',
      habitat: 'Deciduous & evergreen forest trunks',
      foraging_stratum: 'Sub-canopy Bark / Trunks',
      vocal_activity: 'High',
      endemic_status: 'No'
    };
  }

  if (name.includes('flycatcher') || name.includes('fantail') || name.includes('warbler') || name.includes('prinia') || name.includes('tailorbird')) {
    return {
      guild: 'Insectivore (Foliage Gleaner)',
      habitat: 'Dense shrubbery, forest edges, reed beds',
      foraging_stratum: 'Lower Understory & Shrub Layer',
      vocal_activity: 'High',
      endemic_status: 'No'
    };
  }

  if (name.includes('thrush') || name.includes('babbler') || name.includes('laughingthrush')) {
    return {
      guild: 'Omnivore / Invertebrate Feeder',
      habitat: 'Moist ravine undergrowth & leaf litter',
      foraging_stratum: 'Ground / Lower Stratum',
      vocal_activity: 'High',
      endemic_status: name.includes('nilgiri') || name.includes('banasura') || name.includes('palani') ? 'Yes' : 'No'
    };
  }

  if (name.includes('dove') || name.includes('pigeon') || name.includes('munia') || name.includes('sparrow') || name.includes('weaver')) {
    return {
      guild: 'Granivore / Frugivore',
      habitat: 'Agricultural scrub, grassland, secondary growth',
      foraging_stratum: 'Primarily Ground Feeding',
      vocal_activity: 'Moderate',
      endemic_status: name.includes('nilgiri') ? 'Yes' : 'No'
    };
  }

  if (name.includes('heron') || name.includes('kingfisher') || name.includes('egret') || name.includes('stork') || name.includes('bittern')) {
    return {
      guild: 'Piscivore / Wetland Carnivore',
      habitat: 'Riparian streams, freshwater wetlands, mangroves',
      foraging_stratum: 'Aquatic / Edge Interface',
      vocal_activity: 'Moderate',
      endemic_status: 'No'
    };
  }

  // Default ecological profile for tropical Asian birds
  return {
    guild: 'Insectivore / Omnivore',
    habitat: 'Tropical moist forest & woodland edges',
    foraging_stratum: 'Midstory Arboreal Layer',
    vocal_activity: 'Moderate',
    endemic_status: 'No'
  };
}
