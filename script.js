// Конфигурация
const config = {
    symbols: {
        BTCUSDT: {
            name: 'Bitcoin',
            pair: 'BTCUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        TRXUSDT: {
            name: 'Tron',
            pair: 'TRXUSDT',
            priceFormat: {
                minMove: 0.0001,
                precision: 4
            }
        },
        ETHUSDT: {
            name: 'Ethereum',
            pair: 'ETHUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        BNBUSDT: {
            name: 'Binance Coin',
            pair: 'BNBUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        ADAUSDT: {
            name: 'Cardano',
            pair: 'ADAUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        DOGEUSDT: {
            name: 'Dogecoin',
            pair: 'DOGEUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        XRPUSDT: {
            name: 'Ripple',
            pair: 'XRPUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        SOLUSDT: {
            name: 'Solana',
            pair: 'SOLUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        DOTUSDT: {
            name: 'Polkadot',
            pair: 'DOTUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        LINKUSDT: {
            name: 'Chainlink',
            pair: 'LINKUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        AVAXUSDT: {
            name: 'Avalanche',
            pair: 'AVAXUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        MATICUSDT: {
            name: 'Polygon',
            pair: 'MATICUSDT',
            priceFormat: {
                minMove: 0.01,
                precision: 2
            }
        },
        SUIUSDT: {
            name: 'Sui',
            pair: 'SUIUSDT',
            priceFormat: {
                minMove: 0.0001,
                precision: 4
            }
        }
    },
    startDate: (() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 3); // Устанавливаем дату на 3 месяца назад
        return date.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
    defaultInterval: '15m',
    updateInterval: 5 * 60 * 1000 // 5 минут
};

// Текущая выбранная криптовалюта
let currentSymbol = 'BTCUSDT';

// Инициализация графиков
let charts = {};

// Добавляем конфигурацию для уровней Фибоначчи
const fibonacciConfig = {
    colors: {
        0: '#FF0000',    // Красный
        0.236: '#FF7F00', // Оранжевый
        0.382: '#FFFF00', // Желтый
        0.5: '#00FF00',   // Зеленый
        0.618: '#0000FF', // Синий
        0.786: '#4B0082', // Индиго
        1: '#8B00FF'      // Фиолетовый
    },
    labels: {
        0: '0%',
        0.236: '23.6%',
        0.382: '38.2%',
        0.5: '50%',
        0.618: '61.8%',
        0.786: '78.6%',
        1: '100%'
    }
};

// Удаляем конфигурацию для линий
const lineConfig = {
    colors: ['#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#FF5722'],
    lineWidth: 2,
    lineStyle: 0, // 0 = сплошная линия
};

// Глобальные переменные для режима рисования
let isDrawingMode = false;
let currentLine = null;
let startPoint = null;

// Глобальные переменные для линий уровней покупки/продажи
let buyLevelLine = null;
let sellLevelLine = null;

// Функция для маппинга интервалов Binance/Chart -> Bybit
function mapIntervalToBybit(interval) {
    const map = {
        '1m': '1',
        '3m': '3',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '2h': '120',
        '4h': '240',
        '6h': '360',
        '12h': '720',
        '1d': 'D',
        '1w': 'W',
        '1M': 'M'
    };
    return map[interval] || '15'; // Возвращаем '15' по умолчанию
}

// Функции для работы с API - ВОЗВРАЩЕНО К BINANCE
async function fetchHistoricalData(symbol) {
    try {
        console.log(`[fetchHistoricalData] Начало загрузки данных для ${symbol}`);
        
        // Получаем даты из конфигурации и устанавливаем точное время
        const startTime = new Date(config.startDate + 'T00:00:00.000Z');
        const endTime = new Date(config.endDate + 'T23:59:59.999Z');

        const startTimestamp = startTime.getTime();
        const endTimestamp = endTime.getTime();
        
        // Проверяем валидность дат
        if (startTimestamp >= endTimestamp) {
            throw new Error('Начальная дата должна быть раньше конечной даты');
        }
        
        // Проверяем, что даты не в будущем
        const now = new Date();
        now.setHours(23, 59, 59, 999); // Устанавливаем конец текущего дня
        const nowTimestamp = now.getTime();
        
        if (startTimestamp > nowTimestamp) {
            throw new Error('Начальная дата не может быть в будущем');
        }
        
        // Если конечная дата в будущем, используем текущую дату
        if (endTimestamp > nowTimestamp) {
            endTime.setTime(nowTimestamp);
            console.log('[fetchHistoricalData] Конечная дата установлена на текущий момент');
        }

        const maxCandles = 1000;
        const intervalInMs = getIntervalInMs(config.defaultInterval);
        const totalCandles = Math.ceil((endTimestamp - startTimestamp) / intervalInMs);
        
        let allCandles = [];
        
        console.log(`[fetchHistoricalData] Запрос данных для ${symbol}`, {
            interval: config.defaultInterval,
            startTime: new Date(startTimestamp).toISOString(),
            endTime: new Date(endTimestamp).toISOString()
        });

        for (let i = 0; i < Math.ceil(totalCandles / maxCandles); i++) {
            const chunkStartTime = startTimestamp + (i * maxCandles * intervalInMs);
            const chunkEndTime = Math.min(chunkStartTime + (maxCandles * intervalInMs), endTimestamp);
            
            if (chunkStartTime >= chunkEndTime) continue;

            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${config.defaultInterval}&startTime=${chunkStartTime}&endTime=${chunkEndTime}&limit=${maxCandles}`;
            
            try {
                const response = await fetch(url);
                
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                    console.warn(`[fetchHistoricalData] Превышен лимит запросов. Ожидание ${retryAfter} секунд...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    i--; // Повторяем тот же чанк
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                if (data && data.length > 0) {
                    allCandles = allCandles.concat(data);
                }
                
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`[fetchHistoricalData] Ошибка при загрузке чанка данных:`, error);
                await new Promise(resolve => setTimeout(resolve, 5000));
                i--; // Повторяем тот же чанк
            }
        }

        if (allCandles.length === 0) {
            throw new Error(`Нет данных для ${symbol} за выбранный период`);
        }

        console.log(`[fetchHistoricalData] Получено ${allCandles.length} свечей`);
        
        // Форматируем данные для графика
        const formattedData = allCandles.map(candle => ({
            time: candle[0] / 1000,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        })).sort((a, b) => a.time - b.time);
        
        // Фильтруем данные по точному времени
        const filteredData = formattedData.filter(candle => {
            const candleTime = candle.time * 1000;
            return candleTime >= startTimestamp && candleTime <= endTimestamp;
        });
        
        // Убираем дубликаты
        const uniqueCandles = Array.from(new Map(filteredData.map(item => [item.time, item])).values());
        
        console.log(`[fetchHistoricalData] Подготовлено ${uniqueCandles.length} уникальных свечей`);
        return uniqueCandles;
        
    } catch (error) {
        console.error(`[fetchHistoricalData] Ошибка при загрузке данных для ${symbol}:`, error);
        throw error;
    }
}

// Функция для получения интервала в миллисекундах
function getIntervalInMs(interval) {
    const units = {
        'm': 60 * 1000,           // минута
        'h': 60 * 60 * 1000,     // час
        'd': 24 * 60 * 60 * 1000 // день
    };
    
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    
    return value * units[unit];
}

// Расчет индикаторов
function calculateMA(data, period) {
    return data.map((candle, index) => {
        if (index < period - 1) return null;
        const sum = data.slice(index - period + 1, index + 1).reduce((acc, curr) => acc + curr.close, 0);
        return {
            time: candle.time,
            value: sum / period
        };
    }).filter(item => item !== null);
}

function calculateRSI(data, period = 14) {
    const changes = data.map((candle, index) => {
        if (index === 0) return 0;
        return candle.close - data[index - 1].close;
    });

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);

    const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    return data.map((candle, index) => {
        if (index < period) return null;
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return {
            time: candle.time,
            value: rsi
        };
    }).filter(item => item !== null);
}

function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    
    const macd = ema12.map((ema, index) => ({
        time: ema.time,
        value: ema.value - ema26[index].value
    }));

    const signal = calculateEMA(macd, 9);

    const histogram = macd.map((macd, index) => ({
        time: macd.time,
        value: macd.value - signal[index].value
    }));

    return { macd, signal, histogram };
}

function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    let ema = [data[0].close];

    for (let i = 1; i < data.length; i++) {
        ema.push(data[i].close * k + ema[i - 1] * (1 - k));
    }

    return data.map((candle, index) => ({
        time: candle.time,
        value: ema[index]
    }));
}

// Функция форматирования времени
function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Функция инициализации обработчиков событий
function initEventHandlers() {
    try {
        console.log('[initEventHandlers] Начало инициализации обработчиков событий');
        
        const elements = {
            cryptoSymbol: document.getElementById('cryptoSymbol'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            themeToggle: document.getElementById('themeToggle'),
            intervalButtons: document.querySelectorAll('.interval-btn'),
            forecastButtons: document.querySelectorAll('.forecast-btn'),
            calculateButton: document.getElementById('calculateGrid'),
            clearButton: document.getElementById('clearChart'),
            clearLevelsButton: document.getElementById('clearLevels')
        };

        // Проверяем наличие всех необходимых элементов
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                console.warn(`[initEventHandlers] Элемент ${name} не найден`);
            }
        });

        // Обработчик изменения криптовалюты
        if (elements.cryptoSymbol) {
            elements.cryptoSymbol.addEventListener('change', async (e) => {
                try {
                    console.log(`[initEventHandlers] Изменение криптовалюты на ${e.target.value}`);
        currentSymbol = e.target.value;
                    
                    // Пересоздаем график для новой криптовалюты
                    const container = document.querySelector('.chart-container');
                    if (!container) {
                        throw new Error('Контейнер графика не найден');
                    }
                    
                    // Очищаем контейнер
                    container.innerHTML = '';
                    
                    // Создаем новый график
                    charts[currentSymbol] = createChart(container);
                    if (!charts[currentSymbol]) {
                        throw new Error('Не удалось создать график');
                    }
                    
                    // Загружаем данные
        await loadData(currentSymbol);
                    
                    // Устанавливаем WebSocket соединение для новой криптовалюты
                    setupWebSocket(currentSymbol);
                    
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при смене криптовалюты:', error);
                    alert('Ошибка при смене криптовалюты: ' + error.message);
                }
            });
        }

        // Обработчики изменения дат
        if (elements.startDate && elements.endDate) {
            const updateDates = async () => {
                try {
                    console.log('[initEventHandlers] Обновление дат');
                    config.startDate = elements.startDate.value;
                    config.endDate = elements.endDate.value;
            await loadData(currentSymbol);
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при обновлении дат:', error);
                }
            };

            elements.startDate.addEventListener('change', updateDates);
            elements.endDate.addEventListener('change', updateDates);
        }

        // Обработчик переключения темы
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }

        // Обработчики кнопок интервала
        if (elements.intervalButtons) {
            // Устанавливаем активную кнопку по умолчанию
            let activeInterval = config.defaultInterval;
            elements.intervalButtons.forEach(button => {
                if (button.dataset.interval === activeInterval) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            elements.intervalButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const interval = button.dataset.interval;
                        // Снимаем класс active со всех кнопок
                        elements.intervalButtons.forEach(btn => btn.classList.remove('active'));
                        // Добавляем класс active только на выбранную
                        button.classList.add('active');
                        console.log(`[initEventHandlers] Изменение интервала на ${interval}`);
                        await updateInterval(interval);
                    } catch (error) {
                        console.error('[initEventHandlers] Ошибка при изменении интервала:', error);
                    }
                });
            });
        }

        // Обработчики кнопок прогноза
        if (elements.forecastButtons) {
            elements.forecastButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const forecast = button.dataset.forecast;
                        console.log(`[initEventHandlers] Изменение прогноза на ${forecast}`);
                        await updateForecast(forecast);
                    } catch (error) {
                        console.error('[initEventHandlers] Ошибка при изменении прогноза:', error);
                    }
                });
            });
        }

        // Обработчик кнопки расчета грид-бота
        if (elements.calculateButton) {
            elements.calculateButton.addEventListener('click', async () => {
                try {
                    console.log('[initEventHandlers] Запуск расчета грид-бота');
                    const buyPriceInput = document.getElementById('buyPrice');
                    const sellPriceInput = document.getElementById('sellPrice');
                    
                    if (!buyPriceInput || !sellPriceInput) {
                         throw new Error('Не найдены поля ввода цен');
                    }
                    
                    const buyPrice = parseFloat(buyPriceInput.value);
                    const sellPrice = parseFloat(sellPriceInput.value);

                    if (isNaN(buyPrice) || isNaN(sellPrice)) {
                        throw new Error('Введите корректные значения цен');
                    }

                    if (buyPrice <= 0 || sellPrice <= 0) {
                         throw new Error('Цены должны быть положительными');
                    }
                    
                    if (buyPrice >= sellPrice) {
                        throw new Error('Цена покупки должна быть меньше цены продажи');
                    }

                    if (!charts[currentSymbol] || !charts[currentSymbol].candlestickSeries) {
                        throw new Error('Нет данных для расчета');
                    }

                    const data = charts[currentSymbol].candlestickSeries.data();
                    if (!data || data.length === 0) {
                        throw new Error('Нет данных для расчета');
                    }
                    console.log(`Получено ${data.length} свечей для расчета.`); // Отладка

                    // Отрисовываем линии уровней на графике
                    drawPriceLevelLines(buyPrice, sellPrice);

                    const result = calculateGridBot(buyPrice, sellPrice, data);
                    displayGridBotResults(result, buyPrice, sellPrice);
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при расчете грид-бота:', error);
                    alert(error.message);
        }
    });
}

        // Обработчик кнопки очистки
        if (elements.clearButton) {
            elements.clearButton.addEventListener('click', () => {
                try {
                    console.log('[initEventHandlers] Нажата кнопка очистки');
                    clearAllChartElements();
                    console.log('[initEventHandlers] Очистка выполнена успешно');
                } catch (error) {
                    console.error('[initEventHandlers] Ошибка при очистке:', error);
                    alert('Произошла ошибка при очистке графика');
                }
            });
            console.log('[initEventHandlers] Обработчик кнопки очистки установлен');
        } else {
            console.error('[initEventHandlers] Кнопка очистки не найдена в DOM');
        }

        // Обработчик кнопки очистки уровней
        if (elements.clearLevelsButton) {
            elements.clearLevelsButton.addEventListener('click', () => {
                console.log('[initEventHandlers] Нажата кнопка Очистить уровни');
                clearPriceLevelLines(); // Вызываем функцию очистки
            });
        }

        console.log('[initEventHandlers] Инициализация обработчиков событий завершена');
    } catch (error) {
        console.error('[initEventHandlers] Критическая ошибка при инициализации обработчиков:', error);
    }
}

function createChart(container) {
    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { color: 'transparent' },
            textColor: 'var(--text-color)',
        },
        grid: {
            vertLines: { color: 'var(--border-color)' },
            horzLines: { color: 'var(--border-color)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'var(--border-color)',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
        timeScale: {
            borderColor: 'var(--border-color)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
            type: 'price',
            precision: config.symbols[currentSymbol].priceFormat.precision,
            minMove: config.symbols[currentSymbol].priceFormat.minMove,
        }
    });

    const maSeries = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        title: 'MA(20)'
    });

    // Создаем объект с расширенными свойствами
    const chartObject = {
        main: chart,
        candlestickSeries: candlestickSeries,
        maSeries: maSeries,
        // Добавляем свойства для работы с уровнями Фибоначчи
        fibonacciLines: [],
        fibonacciLevels: null,
        fibonacciStartTime: null,
        fibonacciEndTime: null
    };

    console.log('[createChart] График успешно создан');
    return chartObject;
}

async function initCharts() {
    try {
        console.log('[initCharts] Начало инициализации графиков');
        clearPriceLevelLines(); // Очищаем линии при инициализации
        
        const container = document.querySelector('.chart-container');
        if (!container) {
            throw new Error('Контейнер для графика не найден');
        }

        // Очищаем контейнер
        container.innerHTML = '';
        
        // Создаем график
        const chart = createChart(container);
        if (!chart) {
            throw new Error('Не удалось создать график');
        }

        // Сохраняем ссылку на график
        charts[currentSymbol] = chart;

        // Загружаем данные
        const success = await loadData(currentSymbol);
        if (!success) {
            throw new Error('Не удалось загрузить данные');
        }

        console.log('[initCharts] Графики успешно инициализированы');
    } catch (error) {
        console.error('[initCharts] Ошибка при инициализации графиков:', error);
        alert('Ошибка при инициализации графиков: ' + error.message);
    }
}

// Добавляем вызов initCharts при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем начальные даты в полях ввода
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput && endDateInput) {
        startDateInput.value = config.startDate;
        endDateInput.value = config.endDate;
        
        // Устанавливаем максимальную дату для обоих полей как текущую
        const today = new Date().toISOString().split('T')[0];
        startDateInput.max = today;
        endDateInput.max = today;
    }

    initCharts();
    initEventHandlers();
});

// Функция загрузки данных
async function loadData(symbol) {
    try {
        console.log(`[loadData] Загрузка данных для ${symbol}...`);
        clearPriceLevelLines(); // Очищаем линии при загрузке новых данных
        
        if (!charts[symbol]) {
            console.error(`[loadData] График для ${symbol} не инициализирован`);
            throw new Error('График не инициализирован');
        }

        const data = await fetchHistoricalData(symbol);
        if (!data || data.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }
        
        // Получаем даты из конфигурации
        const startDate = new Date(config.startDate);
        const endDate = new Date(config.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        const startTimestamp = startDate.getTime() / 1000;
        const endTimestamp = endDate.getTime() / 1000;
        
        // Фильтруем данные по выбранному периоду
        const filteredData = data.filter(candle => {
            return candle.time >= startTimestamp && candle.time <= endTimestamp;
        });

        if (filteredData.length === 0) {
            throw new Error('Нет данных для выбранного периода');
        }

        // Устанавливаем данные на график
        charts[symbol].candlestickSeries.setData(filteredData);
        
        // Рассчитываем и устанавливаем MA
        if (filteredData.length >= 20) {
            const maData = calculateMA(filteredData, 20);
            charts[symbol].maSeries.setData(maData);
        }

        // Настраиваем видимый диапазон
        if (filteredData.length > 0) { 
            const lastIndex = filteredData.length - 1;
            const firstIndex = Math.max(0, lastIndex - 100); // Показываем последние 100 свечей или меньше
            
            charts[symbol].main.timeScale().setVisibleRange({
                from: filteredData[firstIndex].time, 
                to: endTimestamp
            });
        }

        console.log(`[loadData] Данные успешно загружены для ${symbol}`);
        return true;
    } catch (error) {
        console.error(`[loadData] Ошибка при загрузке данных для ${symbol}:`, error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// WebSocket подключение - РАСКОММЕНТИРОВАНО
function setupWebSocket(symbol) {
    // Закрываем старое соединение, если оно есть
    if (charts[currentSymbol] && charts[currentSymbol].ws) {
        charts[currentSymbol].ws.close();
        console.log(`Закрыто старое WebSocket соединение для ${symbol}`);
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${config.defaultInterval}`;
    console.log(`Подключение к WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => console.log(`WebSocket подключен для ${symbol}`);
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // console.log("WebSocket message:", data); // Отладка
            if (data.k) { // Убедимся, что это сообщение о свече
                const candle = data.k;
                const newCandle = {
                    time: candle.t / 1000,
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v)
                };
                // console.log("Updating chart with WS candle:", newCandle);
                updateChart(symbol, newCandle); 
            }
        } catch (error) {
            console.error(`Ошибка обработки WebSocket данных для ${symbol}:`, error, event.data);
        }
    };
    
    ws.onerror = (error) => {
        console.error(`WebSocket ошибка для ${symbol}:`, error);
        // Попытка переподключения может быть здесь, но аккуратно, чтобы не создавать циклы
    };
    
    ws.onclose = (event) => {
        console.log(`WebSocket закрыт для ${symbol}. Code: ${event.code}, Reason: ${event.reason}`);
        // Простое переподключение через 5 секунд, если закрытие не было чистым
        if (!event.wasClean) {
             console.log("Попытка переподключения WebSocket через 5 секунд...");
            setTimeout(() => setupWebSocket(symbol), 5000);
        }
    };

    // Сохраняем ссылку на WebSocket в объект графика
    if (charts[symbol]) {
        charts[symbol].ws = ws;
    } else {
        console.warn(`Объект charts[${symbol}] не найден при настройке WebSocket`);
    }

    return ws;
}

// Функция обновления графика по данным WebSocket
function updateChart(symbol, newCandle) {
    if (charts[symbol] && charts[symbol].candlestickSeries) {
        charts[symbol].candlestickSeries.update(newCandle);
        
        // Обновляем MA (если нужно)
        if (charts[symbol].maSeries) {
            // Нужно получить текущие данные + новую свечу для пересчета MA
             try {
                const seriesData = charts[symbol].candlestickSeries.data(); // Это может быть затратно
                if (seriesData && seriesData.length > 0) {
                     const maData = calculateMA([...seriesData, newCandle], 20);
                     charts[symbol].maSeries.setData(maData);
                }
             } catch (e) {
                  console.error("Ошибка при получении данных серии для обновления MA:", e);
             }
        }
    } else {
         console.warn(`[updateChart] График или серия свечей для ${symbol} не найдены.`);
    }
}

// Функция для расчета уровней Фибоначчи
function calculateFibonacciLevels(startPrice, endPrice) {
    const diff = endPrice - startPrice;
    return {
        0: startPrice,
        0.236: startPrice + diff * 0.236,
        0.382: startPrice + diff * 0.382,
        0.5: startPrice + diff * 0.5,
        0.618: startPrice + diff * 0.618,
        0.786: startPrice + diff * 0.786,
        1: endPrice
    };
}

// Функция для сохранения уровней Фибоначчи
function saveFibonacciLevels(chart, symbol) {
    if (chart.fibonacciLevels) {
        localStorage.setItem(`fibonacci_${symbol}`, JSON.stringify({
            levels: chart.fibonacciLevels,
            startTime: chart.fibonacciStartTime,
            endTime: chart.fibonacciEndTime
        }));
    }
}

// Функция для загрузки уровней Фибоначчи
function loadFibonacciLevels(chart, symbol) {
    const saved = localStorage.getItem(`fibonacci_${symbol}`);
    if (saved) {
        const data = JSON.parse(saved);
        chart.fibonacciLevels = data.levels;
        chart.fibonacciStartTime = data.startTime;
        chart.fibonacciEndTime = data.endTime;
        drawFibonacciLevels(chart, data.levels[0], data.levels[1], data.startTime, data.endTime);
    }
}

function drawFibonacciLevels(chart, startPrice, endPrice, startTime, endTime) {
    console.log('[drawFibonacciLevels] Начало отрисовки уровней Фибоначчи');
    try {
        // Проверяем наличие графика и его компонентов
        if (!chart || !chart.main) {
            console.error('[drawFibonacciLevels] График не инициализирован');
            return;
        }

        // Инициализируем массив fibonacciLines, если он не существует
        if (!chart.fibonacciLines) {
            chart.fibonacciLines = [];
        }

    // Удаляем предыдущие линии Фибоначчи
    chart.fibonacciLines.forEach(line => {
            if (line) {
        chart.main.removeSeries(line);
            }
    });
    chart.fibonacciLines = [];

    // Сохраняем временные метки
    chart.fibonacciStartTime = startTime;
    chart.fibonacciEndTime = endTime;

    // Рассчитываем уровни
    const levels = calculateFibonacciLevels(startPrice, endPrice);
    chart.fibonacciLevels = levels;

    // Создаем линии для каждого уровня
    Object.entries(levels).forEach(([level, price]) => {
            try {
        const line = chart.main.addLineSeries({
            color: fibonacciConfig.colors[level],
            lineWidth: 1,
            lineStyle: 2, // Пунктирная линия
            title: `Fib ${fibonacciConfig.labels[level]}`,
            priceFormat: {
                type: 'price',
                precision: 2,
            }
        });

        // Добавляем точки для линии
        line.setData([
            { time: startTime, value: price },
            { time: endTime, value: price }
        ]);

                chart.fibonacciLines.push(line);
            } catch (e) {
                console.error(`[drawFibonacciLevels] Ошибка при создании линии для уровня ${level}:`, e);
            }
    });

    // Сохраняем уровни
    saveFibonacciLevels(chart, chart.symbol);
        console.log('[drawFibonacciLevels] Уровни Фибоначчи успешно отрисованы');
    } catch (error) {
        console.error('[drawFibonacciLevels] Ошибка при отрисовке уровней Фибоначчи:', error);
    }
}

// Функция для удаления уровней Фибоначчи
function removeFibonacciLevels(chart) {
    if (chart && chart.fibonacciLines && chart.fibonacciLines.length > 0) {
        chart.fibonacciLines.forEach(line => {
            if (line && chart.main) {
                chart.main.removeSeries(line);
            }
        });
        chart.fibonacciLines = [];
        chart.fibonacciLevels = null;
        chart.fibonacciStartTime = null;
        chart.fibonacciEndTime = null;
        if (chart.symbol) {
            localStorage.removeItem(`fibonacci_${chart.symbol}`);
        }
    }
}

// Обработчик изменения размера окна
window.addEventListener('resize', () => {
    if (charts[currentSymbol] && charts[currentSymbol].main) {
        const chartContainer = document.querySelector('.chart-container');
        charts[currentSymbol].main.applyOptions({
            width: chartContainer.clientWidth
        });
    }image.png
});

// Экспорт в CSV
document.getElementById('exportCSV').addEventListener('click', exportToCSV);

// Автообновление данных
setInterval(async () => {
    for (const [key, value] of Object.entries(config.symbols)) {
        const newData = await fetchHistoricalData(value.pair);
        if (newData.length > 0) {
            charts[key].candlestickSeries.setData(newData);
            updateIndicators(key, newData);
        }
    }
}, config.updateInterval);

// Добавляем обработчики для кнопок управления уровнями Фибоначчи
document.getElementById('fibonacciTool').addEventListener('click', () => {
    console.log('[fibonacciTool] Нажата кнопка Фибоначчи');
    try {
        if (!charts[currentSymbol]) {
            console.error('[fibonacciTool] График не найден');
            alert('График не инициализирован');
            return;
        }

        if (!charts[currentSymbol].candlestickSeries) {
            console.error('[fibonacciTool] Серия свечей не найдена');
            alert('Данные графика не загружены');
        return;
    }

    const data = charts[currentSymbol].candlestickSeries.data();
    if (!data || data.length < 2) {
            console.error('[fibonacciTool] Недостаточно данных для построения уровней Фибоначчи');
            alert('Недостаточно данных для построения уровней Фибоначчи');
        return;
    }

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;

        console.log('[fibonacciTool] Параметры для построения:', {
            startPrice,
            endPrice,
            startTime: new Date(startTime * 1000),
            endTime: new Date(endTime * 1000)
        });

    drawFibonacciLevels(charts[currentSymbol], startPrice, endPrice, startTime, endTime);
    } catch (error) {
        console.error('[fibonacciTool] Ошибка при обработке клика:', error);
        alert('Произошла ошибка при построении уровней Фибоначчи');
    }
});

// Обработчик для кнопки удаления уровней Фибоначчи
document.getElementById('removeFibonacci').addEventListener('click', () => {
    if (charts[currentSymbol]) {
        removeFibonacciLevels(charts[currentSymbol]);
    }
});

// Добавляем обработчики кликов по графикам для определения активного
document.addEventListener('DOMContentLoaded', () => {
    const btcChart = document.querySelector('#chart-btc');
    const trxChart = document.querySelector('#chart-trx');
    
    if (btcChart) {
        btcChart.addEventListener('click', () => {
            btcChart.classList.add('active');
            if (trxChart) trxChart.classList.remove('active');
        });
    }
    
    if (trxChart) {
        trxChart.addEventListener('click', () => {
            trxChart.classList.add('active');
            if (btcChart) btcChart.classList.remove('active');
        });
    }
    
    // По умолчанию активируем график BTC
    if (btcChart) btcChart.classList.add('active');
});

// Загружаем сохраненные уровни при инициализации
for (const [key, chart] of Object.entries(charts)) {
    chart.symbol = key;
    chart.lines = [];
    loadFibonacciLevels(chart, key);
    loadLines(chart, key);
}

function updateChart(symbol, newCandle) {
    if (charts[symbol] && charts[symbol].candlestickSeries) {
        charts[symbol].candlestickSeries.update(newCandle);
        
        // Обновляем MA
        const data = charts[symbol].candlestickSeries.data();
        const maData = calculateMA(data, 20);
        charts[symbol].maSeries.setData(maData);
    }
}

// Функция для сохранения линий
function saveLines(chart, symbol) {
    // Функционал отключен
}

// Функция для загрузки линий
function loadLines(chart, symbol) {
    // Функционал отключен
}

// Добавляем обработчик для кнопки линии
document.getElementById('lineTool').addEventListener('click', () => {
    console.log('Функция временно недоступна');
});

// Функция для отображения лога сделок
function displayTradeLog(tradeLog) {
    const tableBody = document.getElementById('gridTradeLogBody');
    tableBody.innerHTML = ''; // Очищаем таблицу перед заполнением

    if (!tradeLog || tradeLog.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">Сделок не найдено.</td></tr>';
        return;
    }

    tradeLog.forEach(log => {
        const row = tableBody.insertRow();
        const dateCell = row.insertCell();
        const typeCell = row.insertCell();
        const priceCell = row.insertCell();

        dateCell.textContent = new Date(log.time * 1000).toLocaleString('ru-RU');
        typeCell.textContent = log.type;
        priceCell.textContent = log.price.toFixed(2); // Форматируем цену

        // Добавляем класс для стилизации
        row.classList.add(log.type === 'Покупка' ? 'buy-log' : 'sell-log');
    });
}

// Экспорт в CSV
function exportToCSV() {
    if (!charts[currentSymbol] || !charts[currentSymbol].candlestickSeries) {
        alert('Нет данных для экспорта');
        return;
    }

    const BOM = "\uFEFF";
    const headers = ['Время', 'Открытие', 'Максимум', 'Минимум', 'Закрытие', 'Объем'];
    
    const data = charts[currentSymbol].candlestickSeries.data();
    const symbolInfo = config.symbols[currentSymbol];
    
    const csvContent = BOM + [
        `Криптовалюта: ${symbolInfo.name} (${currentSymbol})`,
        `Период: ${config.startDate} - ${config.endDate}`,
        `Интервал: ${config.defaultInterval}`,
        '',
        headers.join(';'),
        ...data.map(candle => [
            new Date(candle.time * 1000).toLocaleString('ru-RU'),
            candle.open.toString().replace('.', ','),
            candle.high.toString().replace('.', ','),
            candle.low.toString().replace('.', ','),
            candle.close.toString().replace('.', ','),
            (candle.volume || 0).toString().replace('.', ',')
        ].join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentSymbol}_${config.startDate}_${config.endDate}_${config.defaultInterval}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function updateInterval(interval) {
    try {
        console.log(`[updateInterval] Обновление интервала на ${interval}`);
        config.defaultInterval = interval;
        await loadData(currentSymbol);
    } catch (error) {
        console.error('[updateInterval] Ошибка при обновлении интервала:', error);
    }
}

async function updateForecast(forecast) {
    try {
        console.log(`[updateForecast] Обновление прогноза на ${forecast}`);
        config.forecastType = forecast;
        await loadData(currentSymbol);
    } catch (error) {
        console.error('[updateForecast] Ошибка при обновлении прогноза:', error);
    }
}

function toggleTheme() {
    try {
        console.log('[toggleTheme] Переключение темы');
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);

        // Обновляем цвета графика
        if (charts[currentSymbol] && charts[currentSymbol].main) {
            const chartOptions = {
                layout: {
                    background: { color: 'transparent' },
                    textColor: getComputedStyle(document.body).getPropertyValue('--text-color'),
                },
                grid: {
                    vertLines: { color: newTheme === 'dark' ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
                    horzLines: { color: newTheme === 'dark' ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
                }
            };
            
            charts[currentSymbol].main.applyOptions(chartOptions);

            // Обновляем цвета для всех серий
            if (charts[currentSymbol].candlestickSeries) {
                charts[currentSymbol].candlestickSeries.applyOptions({
                    upColor: newTheme === 'dark' ? '#26a69a' : '#26a69a',
                    downColor: newTheme === 'dark' ? '#ef5350' : '#ef5350',
                    wickUpColor: newTheme === 'dark' ? '#26a69a' : '#26a69a',
                    wickDownColor: newTheme === 'dark' ? '#ef5350' : '#ef5350',
                });
            }

            if (charts[currentSymbol].maSeries) {
                charts[currentSymbol].maSeries.applyOptions({
                    color: newTheme === 'dark' ? '#2962FF' : '#2962FF',
                });
            }

            // Обновляем цвета для всех линий Фибоначчи
            if (charts[currentSymbol].fibonacciLines) {
                charts[currentSymbol].fibonacciLines.forEach(line => {
                    if (line) {
                        const level = line.options().title.split(' ')[1];
                        line.applyOptions({
                            color: fibonacciConfig.colors[level],
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error('[toggleTheme] Ошибка при переключении темы:', error);
    }
}

// Функция для очистки линий уровней
function clearPriceLevelLines() {
    console.log('[clearPriceLevelLines] Попытка очистки линий...');
    try {
        const series = charts[currentSymbol]?.candlestickSeries; // Получаем серию
        if (!series) {
            console.warn('[clearPriceLevelLines] Серия свечей не найдена!');
            buyLevelLine = null; // Сбрасываем ссылки на всякий случай
            sellLevelLine = null;
            return;
        }
        
        if (buyLevelLine) {
            console.log('[clearPriceLevelLines] Удаление линии покупки...', buyLevelLine);
            series.removePriceLine(buyLevelLine); // Удаляем с серии
            buyLevelLine = null;
            console.log('[clearPriceLevelLines] Линия покупки удалена.');
        } else {
            console.log('[clearPriceLevelLines] Линия покупки не найдена для удаления.');
        }
        if (sellLevelLine) {
            console.log('[clearPriceLevelLines] Удаление линии продажи...', sellLevelLine);
            series.removePriceLine(sellLevelLine); // Удаляем с серии
            sellLevelLine = null;
            console.log('[clearPriceLevelLines] Линия продажи удалена.');
        } else {
            console.log('[clearPriceLevelLines] Линия продажи не найдена для удаления.');
        }
    } catch (e) {
        console.error('[clearPriceLevelLines] Ошибка при удалении линий уровней:', e);
        // Дополнительно сбрасываем ссылки в случае ошибки
        buyLevelLine = null;
        sellLevelLine = null;
    }
}

// Функция для отрисовки линий уровней покупки/продажи
function drawPriceLevelLines(buyPrice, sellPrice) {
    console.log(`[drawPriceLevelLines] Попытка отрисовки линий: Buy=${buyPrice}, Sell=${sellPrice}`);
    try {
        const series = charts[currentSymbol]?.candlestickSeries; // Получаем серию
        if (!series) {
            console.error('[drawPriceLevelLines] Серия свечей не найдена!');
            return;
        }
        console.log('[drawPriceLevelLines] Серия свечей найдена:', series);

        // Очищаем предыдущие линии
        clearPriceLevelLines();

        // Проверяем валидность цен еще раз
        if (isNaN(buyPrice) || isNaN(sellPrice) || buyPrice <= 0 || sellPrice <= 0) {
             console.error('[drawPriceLevelLines] Невалидные цены для отрисовки линий.');
             return;
        }

        // Рисуем линию покупки (зеленая, упрощенный стиль)
        try {
             console.log(`[drawPriceLevelLines] Создание линии покупки: Price=${buyPrice}`);
             buyLevelLine = series.createPriceLine({ // Вызываем у серии
                price: buyPrice,
                color: '#00FF00', // Ярко-зеленый
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid, // Сплошная
                axisLabelVisible: true,
                title: `Buy ${buyPrice.toFixed(2)}`,
             });
             console.log('[drawPriceLevelLines] Линия покупки создана:', buyLevelLine);
        } catch (e) {
             console.error('[drawPriceLevelLines] Ошибка при создании линии покупки:', e);
             buyLevelLine = null;
        }

        // Рисуем линию продажи (красная, упрощенный стиль)
        try {
             console.log(`[drawPriceLevelLines] Создание линии продажи: Price=${sellPrice}`);
             sellLevelLine = series.createPriceLine({ // Вызываем у серии
                price: sellPrice,
                color: '#FF0000', // Ярко-красный
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid, // Сплошная
                axisLabelVisible: true,
                title: `Sell ${sellPrice.toFixed(2)}`,
             });
             console.log('[drawPriceLevelLines] Линия продажи создана:', sellLevelLine);
        } catch (e) {
             console.error('[drawPriceLevelLines] Ошибка при создании линии продажи:', e);
             sellLevelLine = null;
        }
        
        if (buyLevelLine || sellLevelLine) {
            console.log('[drawPriceLevelLines] Линии уровней покупки/продажи отрисованы (или одна из них).');
        } else {
            console.warn('[drawPriceLevelLines] Не удалось отрисовать ни одну линию.');
        }

    } catch (error) {
        console.error('[drawPriceLevelLines] Общая ошибка при отрисовке линий уровней:', error);
    }
}

function calculateGridBot(buyPrice, sellPrice, data) {
    try {
        console.log('[calculateGridBot] Начало расчета (Новая логика)', { buyPrice, sellPrice, dataLength: data.length });
        
        if (!data || data.length === 0) {
            throw new Error('Нет данных для расчета');
        }

        let totalProfit = 0;
        let totalTrades = 0;
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        let trades = [];
        
        let state = 'looking_for_buy';
        let lastBuyPrice = 0;
        let lastBuyTime = 0;
        let maxPriceAfterBuy = 0;

        // Проходим по всем свечам
        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            const candleTime = new Date(candle.time * 1000).toLocaleString();

            // Логика покупки
            if (state === 'looking_for_buy' && candle.low <= buyPrice) {
                lastBuyPrice = buyPrice;
                lastBuyTime = candle.time;
                state = 'looking_for_sell';
                totalBuyAmount++;
                maxPriceAfterBuy = candle.high;
                trades.push({ type: 'buy', price: buyPrice, time: candle.time });
                console.log(`[calculateGridBot] Свеча ${i + 1} (${candleTime}): ПОКУПКА по ${buyPrice} (Low=${candle.low}). Ищем продажу.`);
            }
            // Логика продажи
            else if (state === 'looking_for_sell') {
                // Обновляем максимальную цену после покупки
                maxPriceAfterBuy = Math.max(maxPriceAfterBuy, candle.high);
                
                if (candle.high >= sellPrice) {
                    const profit = sellPrice - lastBuyPrice;
                    totalProfit += profit;
                    totalTrades++;
                    totalSellAmount++;
                    state = 'looking_for_buy';
                    
                    trades.push({ type: 'sell', price: sellPrice, time: candle.time });
                    const buyPositionTime = new Date(lastBuyTime * 1000).toLocaleString();
                    console.log(`[calculateGridBot] Свеча ${i + 1} (${candleTime}): ПРОДАЖА по ${sellPrice} (High=${candle.high}). Закрыта покупка от ${buyPositionTime}. Прибыль: ${profit.toFixed(2)}. Ищем покупку.`);
                    lastBuyPrice = 0;
                    lastBuyTime = 0;
                    maxPriceAfterBuy = 0;
                }
                // Добавляем периодический вывод максимальной достигнутой цены
                else if (i % 10 === 0) { // каждые 10 свечей
                    console.log(`[calculateGridBot] После покупки (${new Date(lastBuyTime * 1000).toLocaleString()}) максимальная цена достигла ${maxPriceAfterBuy} (целевая продажа: ${sellPrice})`);
                }
            }
        }

        // Закрываем позицию в конце периода, если последней была покупка
        if (state === 'looking_for_sell') {
            const lastCandle = data[data.length - 1];
            const lastCandleTime = new Date(lastCandle.time * 1000).toLocaleString();
            const profit = lastCandle.close - lastBuyPrice;
            totalProfit += profit;
            totalSellAmount++;
            
            trades.push({
                type: 'sell',
                price: lastCandle.close,
                time: lastCandle.time
            });
            
            const buyPositionTime = new Date(lastBuyTime * 1000).toLocaleString();
            console.log(`[calculateGridBot] Принудительное закрытие последней покупки (${buyPositionTime}) по цене ${lastCandle.close} (${lastCandleTime}). Прибыль: ${profit.toFixed(2)}`);
            console.log(`[calculateGridBot] Максимальная цена после последней покупки была: ${maxPriceAfterBuy} (целевая продажа: ${sellPrice})`);
        }

        const totalInvestment = buyPrice * totalBuyAmount;
        const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        const result = {
            totalProfit,
            totalTrades,
            totalBuyAmount,
            totalSellAmount,
            profitPercentage,
            trades
        };

        console.log('[calculateGridBot] Результаты расчета (Новая логика):', result);
        return result;
    } catch (error) {
        console.error('[calculateGridBot] Ошибка при расчете:', error);
        throw error;
    }
}

function displayGridBotResults(result, buyPrice, sellPrice) {
    try {
        console.log('[displayGridBotResults] Начало отображения результатов');
        const resultDiv = document.getElementById('gridResult');
        const tradeLogBody = document.getElementById('gridTradeLogBody');

        if (!resultDiv || !tradeLogBody) {
            throw new Error('Не найдены элементы для отображения результатов');
        }

        // Очищаем предыдущие результаты
        tradeLogBody.innerHTML = '';
        resultDiv.innerHTML = '';

        // Рассчитываем процентную разницу между введенными ценами
        const priceDifferencePercent = ((sellPrice - buyPrice) / buyPrice) * 100;

        // Отображаем статистику
        const statsHtml = `
            <div class="grid-stats">
                <p>Всего сделок: ${result.totalTrades}</p>
                <p>Покупок: ${result.totalBuyAmount}</p>
                <p>Продаж: ${result.totalSellAmount}</p>
                <p>Разница цен (указанная): ${priceDifferencePercent.toFixed(2)}%</p>
            </div>
        `;
        resultDiv.innerHTML = statsHtml;
        
        // Отображаем лог сделок, если они есть
        if (result.trades && result.trades.length > 0) {
            result.trades.forEach(trade => {
                const row = document.createElement('tr');
                row.className = trade.type === 'buy' ? 'buy-log' : 'sell-log';
                
                const timeCell = document.createElement('td');
                timeCell.textContent = new Date(trade.time * 1000).toLocaleString();
                
                const typeCell = document.createElement('td');
                typeCell.textContent = trade.type === 'buy' ? 'Покупка' : 'Продажа';
                
                const priceCell = document.createElement('td');
                priceCell.textContent = trade.price.toFixed(2);
                
                row.appendChild(timeCell);
                row.appendChild(typeCell);
                row.appendChild(priceCell);
                tradeLogBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'Сделок не было';
            row.appendChild(cell);
            tradeLogBody.appendChild(row);
        }

        console.log('[displayGridBotResults] Результаты успешно отображены');
    } catch (error) {
        console.error('[displayGridBotResults] Ошибка при отображении результатов:', error);
        alert('Ошибка при отображении результатов: ' + error.message);
    }
}

// Функция для очистки всего графика и связанных элементов
function clearAllChartElements() {
    console.log('[clearAllChartElements] Начало очистки всех элементов');
    
    try {
        // Проверяем инициализацию графика
        if (!charts[currentSymbol]) {
            console.error('[clearAllChartElements] График не инициализирован');
            return;
        }

        // Очистка уровней Фибоначчи
        console.log('[clearAllChartElements] Очистка уровней Фибоначчи');
        if (charts[currentSymbol].fibonacciLines) {
            charts[currentSymbol].fibonacciLines.forEach(line => {
                if (line && charts[currentSymbol].main) {
                    charts[currentSymbol].main.removeSeries(line);
                }
            });
            charts[currentSymbol].fibonacciLines = [];
            charts[currentSymbol].fibonacciLevels = null;
            console.log('[clearAllChartElements] Уровни Фибоначчи удалены');
        }

        // Очистка линий уровней покупки/продажи
        console.log('[clearAllChartElements] Очистка линий уровней');
        const series = charts[currentSymbol].candlestickSeries;
        if (series) {
            if (buyLevelLine) {
                series.removePriceLine(buyLevelLine);
                buyLevelLine = null;
                console.log('[clearAllChartElements] Линия покупки удалена');
            }
            if (sellLevelLine) {
                series.removePriceLine(sellLevelLine);
                sellLevelLine = null;
                console.log('[clearAllChartElements] Линия продажи удалена');
            }
        }

        // Очистка полей ввода
        console.log('[clearAllChartElements] Очистка полей ввода');
        const inputs = {
            buyPrice: document.getElementById('buyPrice'),
            sellPrice: document.getElementById('sellPrice')
        };

        Object.entries(inputs).forEach(([name, input]) => {
            if (input) {
                input.value = '';
                console.log(`[clearAllChartElements] Очищено поле ${name}`);
            }
        });

        // Очистка результатов и лога
        console.log('[clearAllChartElements] Очистка результатов и лога');
        const elements = {
            gridResult: document.getElementById('gridResult'),
            gridTradeLogBody: document.getElementById('gridTradeLogBody')
        };

        Object.entries(elements).forEach(([name, element]) => {
            if (element) {
                element.innerHTML = '';
                console.log(`[clearAllChartElements] Очищен элемент ${name}`);
            }
        });

        console.log('[clearAllChartElements] Все элементы успешно очищены');
    } catch (error) {
        console.error('[clearAllChartElements] Ошибка при очистке элементов:', error);
    }
} 