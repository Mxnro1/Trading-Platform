// Класс для управления монитором
class Monitor {
    constructor() {
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'TRXUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT'];
        this.interval = '1m';
        this.stats = {};
        
        // Инициализация элементов управления
        this.initControls();
        // Инициализация обработчиков вкладок
        this.initTabs();
        // Запуск обновления данных
        this.startUpdates();
    }

    initControls() {
        // Обработчик кнопки обновления
        document.getElementById('refreshMonitor').addEventListener('click', () => this.updateAll());
        
        // Обработчик выбора интервала
        document.getElementById('monitorInterval').addEventListener('change', (e) => {
            this.interval = e.target.value;
            this.updateAll();
        });
    }

    initTabs() {
        // Находим все кнопки вкладок
        const tabButtons = document.querySelectorAll('.tab-button');
        
        // Добавляем обработчик для каждой кнопки
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Убираем активный класс у всех кнопок и контента
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // Добавляем активный класс нажатой кнопке
                button.classList.add('active');

                // Показываем соответствующий контент
                const tabId = button.getAttribute('data-tab');
                const tabContent = document.getElementById(`${tabId}-tab`);
                tabContent.classList.add('active');

                // Если открыта вкладка монитора, обновляем данные
                if (tabId === 'monitor') {
                    this.updateAll();
                }
            });
        });
    }

    async updateAll() {
        console.log('Запуск полного обновления...');
        try {
            // Обновляем обе таблицы
            await Promise.all([
                this.updateMonitorTable(),
                this.updateBtcStatsTable(),
                this.updateTrxStatsTable()
            ]);
            
            // Обновляем статистику сделок для всех строк в обеих таблицах
            const updateTableStats = async (tableId, symbol) => {
                const rows = document.querySelectorAll(`#${tableId} tbody tr`);
                for (const row of rows) {
                    const buyPriceCell = row.querySelector('[data-field="buyPrice"]');
                    const sellPriceCell = row.querySelector('[data-field="sellPrice"]');
                    
                    if (buyPriceCell && sellPriceCell) {
                        const buyPrice = parseFloat(buyPriceCell.textContent);
                        const sellPrice = parseFloat(sellPriceCell.textContent);
                        
                        if (!isNaN(buyPrice) && !isNaN(sellPrice)) {
                            console.log(`Обновление статистики для ${symbol} с ценами: ${buyPrice} - ${sellPrice}`);
                            await this.updateTradeStats(row, buyPrice, sellPrice, symbol);
                        }
                    }
                }
            };

            await Promise.all([
                updateTableStats('statsTable', 'BTCUSDT'),
                updateTableStats('trxStatsTable', 'TRXUSDT')
            ]);

            console.log('Полное обновление завершено');
        } catch (error) {
            console.error('Ошибка при полном обновлении:', error);
        }
    }

    async updateMonitorTable() {
        const tbody = document.getElementById('monitorTableBody');
        tbody.innerHTML = '';

        // Добавляем заголовок для новой колонки, если он ещё не добавлен
        const thead = document.querySelector('#monitorTable thead tr');
        if (thead && !thead.querySelector('.volatility-col')) {
            const th = document.createElement('th');
            th.textContent = 'Волатильность (24ч)';
            th.className = 'volatility-col';
            thead.appendChild(th);
        }

        for (const symbol of this.symbols) {
            try {
                // Получаем текущие данные с Binance
                const [ticker, klines] = await Promise.all([
                    this.fetchTicker(symbol),
                    this.fetchKlines(symbol)
                ]);

                // Рассчитываем индикаторы
                const rsi = this.calculateRSI(klines);
                const trend = this.calculateTrend(klines);

                // Волатильность (24ч): (макс - мин) / средняя цена * 100%
                const high = parseFloat(ticker.highPrice);
                const low = parseFloat(ticker.lowPrice);
                const avg = (high + low) / 2;
                const volatility = avg > 0 ? ((high - low) / avg * 100).toFixed(2) : '0.00';

                // Создаем строку таблицы
                const row = document.createElement('tr');
                const priceChange = parseFloat(ticker.priceChangePercent);
                
                // Формируем отображение пары с разделением (например, BTC - USDT)
                const pairDisplay = symbol.replace('USDT', ' - USDT');

                row.innerHTML = `
                    <td>${pairDisplay}</td>
                    <td>${parseFloat(ticker.lastPrice).toFixed(symbol === 'TRXUSDT' ? 4 : 2)}</td>
                    <td class="${priceChange >= 0 ? 'price-up' : 'price-down'}">${priceChange.toFixed(2)}%</td>
                    <td>${parseFloat(ticker.volume).toFixed(2)}</td>
                    <td>${high.toFixed(symbol === 'TRXUSDT' ? 4 : 2)}</td>
                    <td>${low.toFixed(symbol === 'TRXUSDT' ? 4 : 2)}</td>
                    <td>${rsi.toFixed(2)}</td>
                    <td>${trend}</td>
                    <td>${volatility}%</td>
                `;

                // Добавляем обработчик клика для открытия TradingView
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    const tvSymbol = symbol.replace('USDT', 'USD'); // TradingView чаще использует USD
                    const url = `https://www.tradingview.com/symbols/${tvSymbol}/`;
                    window.open(url, '_blank');
                });

                tbody.appendChild(row);
            } catch (error) {
                console.error(`Ошибка при обновлении данных для ${symbol}:`, error);
            }
        }
    }

    async updateStatsTable() {
        // Обновляем обе таблицы
        await Promise.all([
            this.updateBtcStatsTable(),
            this.updateTrxStatsTable()
        ]);
    }

    async updateBtcStatsTable() {
        const tbody = document.getElementById('statsTableBody');
        if (tbody.children.length === 0) {
            await this.createInitialTable(tbody, 'BTCUSDT');
        } else {
            await this.updateCurrentPriceColumn('BTCUSDT');
        }
    }

    async updateTrxStatsTable() {
        const tbody = document.getElementById('trxStatsTableBody');
        if (tbody.children.length === 0) {
            await this.createInitialTable(tbody, 'TRXUSDT');
        } else {
            await this.updateCurrentPriceColumn('TRXUSDT');
        }
    }

    async createInitialTable(tbody, symbol) {
        try {
            // Очищаем тело таблицы перед заполнением
            tbody.innerHTML = ''; 

            const ticker = await this.fetchTicker(symbol);
            const currentPrice = parseFloat(ticker.lastPrice).toFixed(symbol === 'TRXUSDT' ? 4 : 2); 

            // Используем разные данные для BTC и TRX
            const tableData = symbol === 'BTCUSDT' ? [
                { number: '3.3', buyPrice: '85475', sellPrice: '85690', budget: '10000' },
                { number: '3.2', buyPrice: '85261', sellPrice: '85475', budget: '10000' },
                { number: '3.1', buyPrice: '85050', sellPrice: '85261', budget: '10000' },
                { number: '2.3', buyPrice: '84650', sellPrice: '84950', budget: '10000' },
                { number: '2.2', buyPrice: '84350', sellPrice: '84650', budget: '10000' },
                { number: '2.1', buyPrice: '84050', sellPrice: '84350', budget: '10000' },
                { number: '1.3', buyPrice: '83665', sellPrice: '84000', budget: '10000' },
                { number: '1.2', buyPrice: '83332', sellPrice: '83665', budget: '10000' },
                { number: '1.1', buyPrice: '83000', sellPrice: '83332', budget: '10000' }
            ] : [
                // Обновленные данные для TRX с новыми ценами продажи
                { number: 'T5.5', buyPrice: '0.2516', sellPrice: '0.2525', budget: '5000' }, 
                { number: 'T5.4', buyPrice: '0.2508', sellPrice: '0.2516', budget: '5000' }, 
                { number: 'T5.3', buyPrice: '0.2500', sellPrice: '0.2508', budget: '5000' }, 
                { number: 'T5.2', buyPrice: '0.2491', sellPrice: '0.2500', budget: '5000' }, // Corrected 0,25 to 0.2500
                { number: 'T5.1', buyPrice: '0.2483', sellPrice: '0.2491', budget: '5000' },
                { number: 'T4.5', buyPrice: '0.2475', sellPrice: '0.2483', budget: '5000' },
                { number: 'T4.4', buyPrice: '0.2466', sellPrice: '0.2475', budget: '5000' },
                { number: 'T4.3', buyPrice: '0.2458', sellPrice: '0.2466', budget: '5000' },
                { number: 'T4.2', buyPrice: '0.2450', sellPrice: '0.2458', budget: '5000' }, 
                { number: 'T4.1', buyPrice: '0.2441', sellPrice: '0.2450', budget: '5000' }, // Corrected 0,245 to 0.2450
                { number: 'T3.4', buyPrice: '0.2432', sellPrice: '0.2441', budget: '5000' },
                { number: 'T3.3', buyPrice: '0.2423', sellPrice: '0.2432', budget: '5000' },
                { number: 'T3.2', buyPrice: '0.2414', sellPrice: '0.2423', budget: '5000' },
                { number: 'T3.1', buyPrice: '0.2405', sellPrice: '0.2414', budget: '5000' },
            ];

            for (const [index, data] of tableData.entries()) {
                const row = document.createElement('tr');
                
                const buyPrice = parseFloat(data.buyPrice);
                const sellPrice = parseFloat(data.sellPrice);
                const percentDiff = ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
                
                const budget = parseFloat(data.budget);
                const volumePrecision = symbol === 'TRXUSDT' ? 2 : 8;
                const volume = (budget / buyPrice).toFixed(volumePrecision);
                const waiting = (volume * sellPrice - budget).toFixed(2);
                // Рассчитываем Продажу
                const sellAmount = (volume * parseFloat(currentPrice)).toFixed(2);
                // Рассчитываем Баланс
                const balance = (parseFloat(sellAmount) - budget).toFixed(2);
                
                const stats = {
                    number: data.number,
                    currentPrice: currentPrice,
                    buyPrice: data.buyPrice,
                    sellPrice: data.sellPrice,
                    percentDiff: percentDiff,
                    volume: volume,
                    budget: data.budget,
                    sellAmount: sellAmount, 
                    waitTime: waiting,
                    balance: balance,
                    dayProfit: '0',
                    yesterdayProfit: '0',
                    period: '0'
                };
                
                row.innerHTML = `
                    <td class="editable" data-field="number" data-row="${index}">${stats.number}</td>
                    <td class="current-price">${stats.currentPrice}</td>
                    <td class="editable" data-field="buyPrice" data-row="${index}">${stats.buyPrice}</td>
                    <td class="editable" data-field="sellPrice" data-row="${index}">${stats.sellPrice}</td>
                    <td>${stats.percentDiff}%</td>
                    <td class="editable" data-field="volume" data-row="${index}">${stats.volume}</td>
                    <td class="editable" data-field="budget" data-row="${index}">${stats.budget}</td>
                    <td>${stats.sellAmount}</td>
                    <td>${stats.waitTime}</td>
                    <td>${stats.balance}</td>
                    <td>${stats.dayProfit}</td>
                    <td>${stats.yesterdayProfit}</td>
                    <td>${stats.period}</td>
                `;

                tbody.appendChild(row);
                
                // Обновляем статистику сделок для каждой строки
                await this.updateTradeStats(row, buyPrice, sellPrice, symbol);
            }

            this.initializeEditableFields();
        } catch (error) {
            console.error(`Ошибка при создании таблицы для ${symbol}:`, error);
        }
    }

    async updateCurrentPriceColumn(symbol) {
        try {
            const ticker = await this.fetchTicker(symbol);
            const pricePrecision = symbol === 'TRXUSDT' ? 4 : 2;
            const currentPrice = parseFloat(ticker.lastPrice).toFixed(pricePrecision);
            
            const tableId = symbol === 'BTCUSDT' ? 'statsTable' : 'trxStatsTable';
            document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
                // Обновляем текущую цену
                const priceCell = row.querySelector('.current-price');
                if (priceCell) {
                    priceCell.textContent = currentPrice;
                }

                // Обновляем продажу
                const volumeCell = row.querySelector('td:nth-child(6)');
                const sellAmountCell = row.querySelector('td:nth-child(8)');
                const budgetCell = row.querySelector('td:nth-child(7)'); // Ячейка Бюджет
                const balanceCell = row.querySelector('td:nth-child(10)'); // Ячейка Баланс

                if (volumeCell && sellAmountCell && budgetCell && balanceCell) {
                    const volume = parseFloat(volumeCell.textContent);
                    const budget = parseFloat(budgetCell.textContent);

                    if (!isNaN(volume) && !isNaN(budget)) {
                        const sellAmount = (volume * parseFloat(currentPrice)).toFixed(2);
                        sellAmountCell.textContent = sellAmount;

                        // Обновляем баланс
                        const balance = (parseFloat(sellAmount) - budget).toFixed(2);
                        balanceCell.textContent = balance;
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка при обновлении текущей цены:', error);
        }
    }

    initializeEditableFields() {
        const editableCells = document.querySelectorAll('.editable');
        
        editableCells.forEach(cell => {
            cell.addEventListener('click', () => {
                // Проверяем, не редактируется ли уже ячейка
                if (cell.querySelector('input')) return;
                
                const currentValue = cell.textContent;
                const field = cell.getAttribute('data-field');
                const row = cell.getAttribute('data-row');
                
                // Создаем поле ввода
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentValue;
                input.className = 'cell-input';
                
                // Заменяем содержимое ячейки на поле ввода
                cell.textContent = '';
                cell.appendChild(input);
                input.focus();
                
                // Обработчик потери фокуса
                input.addEventListener('blur', () => {
                    this.saveEditedValue(cell, input.value, field, row);
                });
                
                // Обработчик нажатия Enter
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });
            });
        });
    }

    saveEditedValue(cell, value, field, row) {
        cell.textContent = value;
        
        const tr = cell.parentElement;
        const symbol = tr.closest('table').id === 'statsTable' ? 'BTCUSDT' : 'TRXUSDT';
        
        // Если изменились цены, обновляем все расчеты
        if (field === 'buyPrice' || field === 'sellPrice') {
            const buyPriceCell = tr.querySelector('[data-field="buyPrice"]');
            const sellPriceCell = tr.querySelector('[data-field="sellPrice"]');
            const buyPrice = parseFloat(buyPriceCell.textContent);
            const sellPrice = parseFloat(sellPriceCell.textContent);
            
            // Обновляем статистику сделок
            this.updateTradeStats(tr, buyPrice, sellPrice, symbol);
        }
        
        // Если изменилась цена закупа или бюджет, пересчитываем объем, ожидание, продажу и баланс
        if (field === 'buyPrice' || field === 'budget') {
            const buyPriceCell = tr.querySelector('[data-field="buyPrice"]');
            const budgetCell = tr.querySelector('[data-field="budget"]');
            const volumeCell = tr.querySelector('[data-field="volume"]');
            const sellPriceCell = tr.querySelector('[data-field="sellPrice"]');
            const waitingCell = tr.querySelector('td:nth-child(9)'); 
            const sellAmountCell = tr.querySelector('td:nth-child(8)'); 
            const currentPriceCell = tr.querySelector('td:nth-child(2)'); 
            const balanceCell = tr.querySelector('td:nth-child(10)'); // Ячейка Баланс
            
            const buyPrice = parseFloat(buyPriceCell.textContent);
            // Берем новое значение бюджета прямо из ячейки
            const budget = parseFloat(budgetCell.textContent); 
            const sellPrice = parseFloat(sellPriceCell.textContent);
            const currentPrice = parseFloat(currentPriceCell.textContent);
            
            if (!isNaN(buyPrice) && !isNaN(budget) && buyPrice > 0) { 
                const volumePrecision = symbol === 'TRXUSDT' ? 2 : 8;
                const volume = (budget / buyPrice).toFixed(volumePrecision);
                volumeCell.textContent = volume;
                
                // Пересчитываем ожидание
                if (!isNaN(sellPrice)) {
                    const waiting = (volume * sellPrice - budget).toFixed(2);
                    waitingCell.textContent = waiting;
                }

                // Пересчитываем продажу
                if (!isNaN(currentPrice)) {
                    const sellAmount = (volume * currentPrice).toFixed(2);
                    sellAmountCell.textContent = sellAmount;

                    // Пересчитываем баланс (Продажа - Бюджет)
                    const balance = (parseFloat(sellAmount) - budget).toFixed(2);
                    balanceCell.textContent = balance;
                }
            }
        }
        
        // Если изменилась цена продажи, пересчитываем ожидание
        if (field === 'sellPrice') {
            const volumeCell = tr.querySelector('[data-field="volume"]');
            const budgetCell = tr.querySelector('[data-field="budget"]');
            const sellPriceCell = tr.querySelector('[data-field="sellPrice"]');
            const waitingCell = tr.querySelector('td:nth-child(9)'); // Ожидание теперь 9-й столбец
            
            const volume = parseFloat(volumeCell.textContent);
            const budget = parseFloat(budgetCell.textContent);
            const sellPrice = parseFloat(sellPriceCell.textContent);
            
            if (!isNaN(volume) && !isNaN(sellPrice) && !isNaN(budget)) {
                const waiting = (volume * sellPrice - budget).toFixed(2);
                waitingCell.textContent = waiting;
            }
        }
        
        // Если изменилась цена закупа или продажи, пересчитываем процент
        if (field === 'buyPrice' || field === 'sellPrice') {
            const buyPriceCell = tr.querySelector('[data-field="buyPrice"]');
            const sellPriceCell = tr.querySelector('[data-field="sellPrice"]');
            const percentCell = tr.querySelector('td:nth-child(5)'); // Процент теперь 5-й столбец
            
            const buyPrice = parseFloat(buyPriceCell.textContent);
            const sellPrice = parseFloat(sellPriceCell.textContent);
            
            if (!isNaN(buyPrice) && !isNaN(sellPrice)) {
                const percentDiff = ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
                percentCell.textContent = percentDiff + '%';
            }
        }
        
        console.log(`Сохранено значение: ${value} для поля ${field} в строке ${row} (${symbol})`);
    }

    // API методы
    async fetchTicker(symbol) {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        return await response.json();
    }

    async fetchKlines(symbol) {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${this.interval}&limit=100`);
        return await response.json();
    }

    async fetchTradeStats(symbol) {
        // Возвращаем пустые значения для всех полей
        return {
            currentPrice: '-',
            buyPrice: '-',
            sellPrice: '-',
            volume: '-',
            budget: '-',
            sellAmount: '-',
            waitTime: '-',
            balance: '-',
            dayProfit: '-',
            yesterdayProfit: '-',
            period: '-'
        };
    }

    async fetchTradesForPeriod(symbol, startTime, endTime) {
        try {
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            console.log(`Запрос данных для периода: ${startDate.toISOString()} - ${endDate.toISOString()}`);
            
            // Используем 15-минутный интервал
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&startTime=${startTime}&endTime=${endTime}&limit=1000`;
            console.log(`URL запроса: ${url}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                console.error('Получены некорректные данные:', data);
                return [];
            }

            console.log(`Получено ${data.length} свечей для периода`);
            console.log(`Первая свеча: ${new Date(data[0][0]).toISOString()}`);
            console.log(`Последняя свеча: ${new Date(data[data.length - 1][0]).toISOString()}`);

            // Преобразуем в нужный формат
            return data.map(kline => ({
                time: parseInt(kline[0] / 1000),
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4])
            }));
        } catch (error) {
            console.error('Ошибка при получении данных:', error);
            return [];
        }
    }

    calculateGridBot(buyPrice, sellPrice, data) {
        if (!data || data.length === 0) {
            return 0;
        }

        buyPrice = parseFloat(buyPrice);
        sellPrice = parseFloat(sellPrice);
        let trades = 0;
        let inPosition = false;
        let lastTradePrice = 0;

        console.log(`Расчет сделок для диапазона ${buyPrice} - ${sellPrice}`);
        console.log(`Анализ ${data.length} свечей с ${new Date(data[0].time * 1000).toISOString()} по ${new Date(data[data.length - 1].time * 1000).toISOString()}`);

        for (let i = 0; i < data.length; i++) {
            const candle = data[i];
            
            // Если мы не в позиции и цена опустилась ниже уровня покупки
            if (!inPosition && candle.low <= buyPrice) {
                inPosition = true;
                lastTradePrice = buyPrice;
                trades++;
                console.log(`Покупка на свече ${new Date(candle.time * 1000).toISOString()} по цене ${buyPrice}`);
            }
            // Если мы в позиции и цена поднялась выше уровня продажи
            else if (inPosition && candle.high >= sellPrice) {
                inPosition = false;
                lastTradePrice = sellPrice;
                trades++;
                console.log(`Продажа на свече ${new Date(candle.time * 1000).toISOString()} по цене ${sellPrice}`);
            }
        }

        // Возвращаем количество полных циклов
        const completedTrades = Math.floor(trades / 2);
        console.log(`Всего сделок: ${trades}, полных циклов: ${completedTrades}`);
        return completedTrades;
    }

    async updateTradeStats(row, buyPrice, sellPrice, symbol) {
        // Используем текущую дату
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Период с первого дня текущего месяца по текущую дату
        const periodStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
        const periodEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        try {
            console.log(`=== Начало обновления статистики для ${symbol} ===`);
            console.log(`Расчет для цен: покупка=${buyPrice}, продажа=${sellPrice}`);

            // Получаем данные за сегодня и вчера
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).getTime();
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime();
            const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0).getTime();
            const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).getTime();

            console.log('\nЗапрос данных за сегодня:');
            const todayCandles = await this.fetchTradesForPeriod(symbol, todayStart, todayEnd);
            console.log('\nЗапрос данных за вчера:');
            const yesterdayCandles = await this.fetchTradesForPeriod(symbol, yesterdayStart, yesterdayEnd);

            // Подсчет сделок за сегодня и вчера
            const todayCount = this.calculateGridBot(buyPrice, sellPrice, todayCandles);
            const yesterdayCount = this.calculateGridBot(buyPrice, sellPrice, yesterdayCandles);

            // Подсчет сделок за весь период по дням
            let totalPeriodCount = 0;
            const currentDate = new Date(periodStart);

            console.log('\nПодсчет сделок по дням:');
            while (currentDate <= periodEnd) {
                const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0).getTime();
                const dayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59).getTime();

                console.log(`\nЗапрос данных за ${currentDate.toLocaleDateString()}:`);
                const dayCandles = await this.fetchTradesForPeriod(symbol, dayStart, dayEnd);
                const dayCount = this.calculateGridBot(buyPrice, sellPrice, dayCandles);
                console.log(`Количество сделок за ${currentDate.toLocaleDateString()}: ${dayCount}`);

                totalPeriodCount += dayCount;
                currentDate.setDate(currentDate.getDate() + 1);
            }

            console.log(`\nРезультаты подсчета:`);
            console.log(`За период (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}): ${totalPeriodCount} сделок`);
            console.log(`За сегодня (${today.toLocaleDateString()}): ${todayCount} сделок`);
            console.log(`За вчера (${yesterday.toLocaleDateString()}): ${yesterdayCount} сделок`);

            // Обновляем ячейки в таблице (индексы изменились!)
            const dayCell = row.querySelector('td:nth-child(11)'); // Был 11
            const yesterdayCell = row.querySelector('td:nth-child(12)'); // Был 12
            const periodCell = row.querySelector('td:nth-child(13)'); // Был 13

            if (dayCell && yesterdayCell && periodCell) {
                dayCell.textContent = todayCount;
                yesterdayCell.textContent = yesterdayCount;
                periodCell.textContent = totalPeriodCount;
            }

            console.log(`=== Обновление статистики для ${symbol} завершено ===\n`);
        } catch (error) {
            console.error('Ошибка при обновлении статистики сделок:', error);
        }
    }

    // Вспомогательные методы
    calculateRSI(klines) {
        // Упрощенный расчет RSI
        const prices = klines.map(k => parseFloat(k[4]));
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const difference = prices[i] - prices[i-1];
            gains.push(difference > 0 ? difference : 0);
            losses.push(difference < 0 ? Math.abs(difference) : 0);
        }

        const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
        const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateTrend(klines) {
        const prices = klines.map(k => parseFloat(k[4]));
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        
        if (lastPrice > firstPrice) return '↑ Восходящий';
        if (lastPrice < firstPrice) return '↓ Нисходящий';
        return '→ Боковой';
    }

    startUpdates() {
        // Первоначальное обновление
        this.updateAll();
        
        // Обновление каждую минуту
        setInterval(() => {
            console.log('Запуск автоматического обновления...');
            this.updateAll();
        }, 60000); // Обновление каждую минуту
    }
}

// Инициализация монитора при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.monitor = new Monitor();
}); 