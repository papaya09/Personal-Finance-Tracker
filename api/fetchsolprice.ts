let solPrice: number = 0;

// Fetch SOL price initially and then set up a timer to update it every 5 minutes
async function setupSolPriceUpdate() {
  await updateSolPrice(); // Fetch SOL price initially
  setInterval(updateSolPrice, 1 * 60 * 1000); // Update SOL price every 5 minutes
}

async function updateSolPrice() {
  // Fetch the latest SOL price
  const newPrice = await getCurrentSolPrice();
  if (newPrice !== 0) {
    solPrice = newPrice; // Update solPrice only if the new price is valid
    console.log(`Updated SOLANA PRICE : ${solPrice}`);
  } else {
    console.log('Failed to update SOL price!');
  }
}

async function getCurrentSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=solana');
    const data = await response.json();
    const price = Number(data[0].current_price);

    if (price <= 0) {
      return solPrice;
    }

    return price;
  } catch (e) {
    console.error('Failed to fetch SOL price:', e);
    return solPrice;
  }
}

export { solPrice, setupSolPriceUpdate, getCurrentSolPrice };