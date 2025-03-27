document.addEventListener('DOMContentLoaded', function() {
  // Initial elements - the "building blocks" of our drug craft system
  const initialElements = [
    { id: 'plant', name: 'Plant', icon: '🌿', category: 'natural' },
    { id: 'chemical', name: 'Chemical', icon: '⚗️', category: 'synthetic' },
    { id: 'method', name: 'Method', icon: '🧪', category: 'process' },
    { id: 'container', name: 'Container', icon: '📦', category: 'equipment' }
  ];
  
  // Cache for storing previously generated combinations
  let combinationsCache = {};
  
  // Try to load cache from localStorage
  try {
    const savedCache = localStorage.getItem('drugCraftCombinations');
    if (savedCache) {
      combinationsCache = JSON.parse(savedCache);
    }
  } catch (e) {
    console.error('Error loading cache:', e);
  }
  
  // Track discovered elements
  let discoveredElements = [...initialElements];
  
  // Try to load discovered elements from localStorage
  try {
    const savedElements = localStorage.getItem('drugCraftElements');
    if (savedElements) {
      discoveredElements = JSON.parse(savedElements);
    }
  } catch (e) {
    console.error('Error loading elements:', e);
  }
  
  // DOM elements
  const elementsList = document.getElementById('elements-list');
  const combinationZone = document.getElementById('combination-zone');
  const firstElement = document.getElementById('first-element');
  const secondElement = document.getElementById('second-element');
  const resultZone = document.getElementById('result-zone');
  const resetButton = document.getElementById('reset-button');
  const searchBar = document.getElementById('search-bar');
  const categoriesContainer = document.getElementById('categories');
  
  // Selected elements for combination
  let selectedElements = [];
  
  // Active category filter
  let activeCategory = 'all';
  
  // Initialize the game
  function initGame() {
    renderElements();
    renderCategories();
    setupEventListeners();
  }
  
  // Render category filters
  function renderCategories() {
    // Get unique categories
    const categories = ['all'];
    discoveredElements.forEach(element => {
      if (element.category && !categories.includes(element.category)) {
        categories.push(element.category);
      }
    });
    
    // Render category buttons
    categoriesContainer.innerHTML = '';
    categories.forEach(category => {
      const button = document.createElement('button');
      button.className = `category ${category === activeCategory ? 'active' : ''}`;
      button.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      button.dataset.category = category;
      categoriesContainer.appendChild(button);
    });
  }
  
  // Render all discovered elements in the panel
  function renderElements(searchTerm = '') {
    elementsList.innerHTML = '';
    
    // Filter elements by search term and category
    const filteredElements = discoveredElements.filter(element => {
      const matchesSearch = searchTerm === '' || 
        element.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'all' || 
        element.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    
    filteredElements.forEach(element => {
      const elementDiv = createElementDiv(element);
      elementsList.appendChild(elementDiv);
    });
  }
  
  // Create an element div
  function createElementDiv(element) {
    const div = document.createElement('div');
    div.className = 'element';
    div.dataset.id = element.id;
    div.innerHTML = `<span class="element-icon">${element.icon}</span> ${element.name}`;
    return div;
  }
  
  // Setup event listeners
  function setupEventListeners() {
    // Element selection
    elementsList.addEventListener('click', function(e) {
      const elementDiv = e.target.closest('.element');
      if (!elementDiv) return;
      
      selectElement(elementDiv);
    });
    
    // Reset button
    resetButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to reset all your discoveries? This will keep previously generated combinations but clear your inventory.')) {
        discoveredElements = [...initialElements];
        selectedElements = [];
        resetCombinationZone();
        saveToLocalStorage();
        renderElements();
        renderCategories();
      }
    });
    
    // Search functionality
    searchBar.addEventListener('input', function(e) {
      renderElements(e.target.value);
    });
    
    // Category filtering
    categoriesContainer.addEventListener('click', function(e) {
      const categoryButton = e.target.closest('.category');
      if (!categoryButton) return;
      
      activeCategory = categoryButton.dataset.category;
      
      // Update active class
      document.querySelectorAll('.category').forEach(btn => {
        btn.classList.remove('active');
      });
      categoryButton.classList.add('active');
      
      renderElements(searchBar.value);
    });
  }
  
  // Select an element for combination
  function selectElement(elementDiv) {
    const elementId = elementDiv.dataset.id;
    const element = discoveredElements.find(e => e.id === elementId);
    
    if (selectedElements.length < 2) {
      selectedElements.push(element);
      
      if (selectedElements.length === 1) {
        // First element selected
        firstElement.innerHTML = `<div class="element">${element.icon} ${element.name}</div>`;
        firstElement.classList.remove('placeholder');
      } else {
        // Second element selected
        secondElement.innerHTML = `<div class="element">${element.icon} ${element.name}</div>`;
        secondElement.classList.remove('placeholder');
        
        // Process the combination after a short delay
        setTimeout(processCombination, 500);
      }
    }
  }
  
  // Process the combination of selected elements
  async function processCombination() {
    // Sort elements to ensure consistent key regardless of order selected
    const sortedElements = [...selectedElements].sort((a, b) => a.id.localeCompare(b.id));
    const element1 = sortedElements[0];
    const element2 = sortedElements[1];
    
    // Create a unique key for this combination
    const combinationKey = `${element1.id}+${element2.id}`;
    
    // Check if we already have this combination in cache
    if (combinationsCache[combinationKey]) {
      handleCombinationResult(combinationsCache[combinationKey]);
    } else {
      // Need to generate a new combination via AI
      resultZone.innerHTML = `<div class="loading"></div> Generating combination...`;
      
      try {
        // Generate combination with AI
        const result = await generateCombination(element1, element2);
        
        // Store in cache
        combinationsCache[combinationKey] = result;
        saveToLocalStorage();
        
        // Process the result
        handleCombinationResult(result);
      } catch (error) {
        resultZone.innerHTML = `<p>Error generating combination: ${error.message}</p>`;
        console.error('Error generating combination:', error);
        setTimeout(resetCombinationZone, 3000);
      }
    }
  }
  
  // Handle the result of a combination
  function handleCombinationResult(result) {
    // Check if this is a new discovery
    const isNewDiscovery = !discoveredElements.some(e => e.id === result.id);
    
    if (isNewDiscovery) {
      // Add to discovered elements
      discoveredElements.push(result);
      saveToLocalStorage();
      
      // Update the elements panel
      renderElements();
      renderCategories();
    }
    
    // Show result
    resultZone.innerHTML = `
      <div class="element">
        <span class="element-icon">${result.icon}</span> ${result.name}
        ${isNewDiscovery ? ' <span style="color: #4ecdc4;">(New Discovery!)</span>' : ''}
      </div>
    `;
    
    // Reset the combination zone after a delay
    setTimeout(resetCombinationZone, 2000);
  }
  
  // Generate a combination using AI
  async function generateCombination(element1, element2) {
    // For local development & testing fallback
    if (!window.fetch) {
      console.warn('Fetch not available, using fallback combinations');
      return fallbackGeneration(element1, element2);
    }
    
    try {
      // This would be your API endpoint for the AI service
      const apiUrl = document.location.hostname.includes('localhost') || 
                     document.location.hostname === '127.0.0.1' 
        ? '/api/generate-combination'  // When running in Next.js dev server
        : 'api.js';                    // When running standalone HTML
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          element1,
          element2,
          context: 'drug_craft'
        }),
      });
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const data = await response.json();
      return {
        id: data.id || generateUniqueId(element1, element2),
        name: data.name,
        icon: data.icon,
        category: data.category || determineCategoryFromElements(element1, element2),
        description: data.description || ''
      };
    } catch (error) {
      console.error('Error fetching from AI service:', error);
      // Fall back to local generation
      return fallbackGeneration(element1, element2);
    }
  }
  
  // Fallback generation for when AI is not available
  function fallbackGeneration(element1, element2) {
    // Simple hardcoded fallbacks based on element combinations
    const basicCombinations = {
      'plant+plant': { id: 'weed', name: 'Weed', icon: '🥬', category: 'natural' },
      'plant+chemical': { id: 'cocaine', name: 'Cocaine', icon: '❄️', category: 'drug' },
      'plant+method': { id: 'extract', name: 'Plant Extract', icon: '💧', category: 'process' },
      'plant+container': { id: 'stash', name: 'Plant Stash', icon: '🧺', category: 'equipment' },
      'chemical+chemical': { id: 'meth', name: 'Meth', icon: '💎', category: 'synthetic' },
      'method+chemical': { id: 'lab', name: 'Lab Process', icon: '🔬', category: 'process' },
      'weed+method': { id: 'joint', name: 'Joint', icon: '🚬', category: 'consumption' },
      'cocaine+method': { id: 'powder', name: 'White Powder', icon: '🤧', category: 'drug' }
    };
    
    const combinationKey = `${element1.id}+${element2.id}`;
    const reversedKey = `${element2.id}+${element1.id}`;
    
    if (basicCombinations[combinationKey]) {
      return basicCombinations[combinationKey];
    } else if (basicCombinations[reversedKey]) {
      return basicCombinations[reversedKey];
    } else {
      // Generate a creative fallback
      return generateCreativeFallback(element1, element2);
    }
  }
  
  // Generate a creative fallback when no predetermined combination exists
  function generateCreativeFallback(element1, element2) {
    const commonDrugs = [
      {name: 'Heroin', icon: '💉', category: 'opioid'},
      {name: 'LSD', icon: '🧠', category: 'psychedelic'},
      {name: 'MDMA', icon: '💊', category: 'stimulant'},
      {name: 'DMT', icon: '👁️', category: 'psychedelic'},
      {name: 'Mushrooms', icon: '🍄', category: 'natural'},
      {name: 'Prescription Pills', icon: '💊', category: 'pharmaceutical'},
      {name: 'Amphetamine', icon: '⚡', category: 'stimulant'},
      {name: 'Opium', icon: '🌺', category: 'opioid'},
      {name: 'Hash', icon: '🟤', category: 'cannabis'},
      {name: 'Ketamine', icon: '🐴', category: 'dissociative'}
    ];
    
    const randomDrug = commonDrugs[Math.floor(Math.random() * commonDrugs.length)];
    
    return {
      id: `${element1.id}_${element2.id}_${randomDrug.name.toLowerCase().replace(/\s/g, '_')}`,
      name: randomDrug.name,
      icon: randomDrug.icon,
      category: randomDrug.category,
      description: `A combination of ${element1.name} and ${element2.name}`
    };
  }
  
  // Generate a unique ID for new elements
  function generateUniqueId(element1, element2) {
    return `${element1.id}_${element2.id}_${Date.now().toString(36)}`;
  }
  
  // Determine category based on parent elements
  function determineCategoryFromElements(element1, element2) {
    // Some basic rules for category inheritance
    if (element1.category === element2.category) {
      return element1.category; // Same category
    }
    
    if (element1.category === 'synthetic' || element2.category === 'synthetic') {
      return 'synthetic'; // Synthetic takes precedence
    }
    
    if ((element1.category === 'natural' && element2.category === 'process') || 
        (element2.category === 'natural' && element1.category === 'process')) {
      return 'drug'; // Natural + Process often makes a drug
    }
    
    return 'miscellaneous'; // Default category
  }
  
  // Reset the combination zone
  function resetCombinationZone() {
    firstElement.innerHTML = '';
    secondElement.innerHTML = '';
    firstElement.classList.add('placeholder');
    secondElement.classList.add('placeholder');
    selectedElements = [];
    resultZone.innerHTML = '<p>Combine elements to see the result</p>';
  }
  
  // Save current state to localStorage
  function saveToLocalStorage() {
    try {
      localStorage.setItem('drugCraftElements', JSON.stringify(discoveredElements));
      localStorage.setItem('drugCraftCombinations', JSON.stringify(combinationsCache));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }
  
  // Initialize the game
  initGame();
});