// 定义全局变量
let teachers = []; // 存储所有教师数据
let winners = []; // 存储中奖者数据
let prizeConfig = {}; // 存储奖项配置
let isRolling = false;
let rollInterval = null;
let hasDrawnResult = false;
let selectedItemName = ''; // 存储选中的具体奖品名称

// 页面加载时从PHP获取数据
window.addEventListener('load', function() {
    // 首先加载奖项配置
    loadPrizeConfig()
        .then(() => {
            // 加载教师数据
            return fetch('tool/api.php/get_teachers');
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.message);
            }
            teachers = data;
            console.log('成功加载教师数据，共' + teachers.length + '条记录');
            // 加载已有的中奖记录
            loadWinners();
            updateStockDisplay();
            // 更新奖项下拉框
            updatePrizeSelect();
        })
        .catch(error => {
            console.error('数据加载失败:', error);
            alert('数据加载失败：' + error.message);
        });
});

// 加载奖项配置
function loadPrizeConfig() {
    return fetch('tool/api.php/get_prizes')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.message);
            }
            // 检查数据结构
            if (!data || typeof data !== 'object') {
                throw new Error('奖项配置数据格式错误');
            }
            
            // 验证每个奖项的数据结构
            Object.keys(data).forEach(key => {
                const prize = data[key];
                if (!prize.items || !Array.isArray(prize.items)) {
                    throw new Error(`奖项 ${key} 的配置格式错误`);
                }
            });
            
            prizeConfig = data;
            console.log('成功加载奖项配置:', prizeConfig);
        })
        .catch(error => {
            console.error('加载奖项配置失败:', error);
            throw error; // 继续向上传递错误
        });
}

// 更新奖项下拉框
function updatePrizeSelect() {
    const select = document.getElementById('prizeSelect');
    select.innerHTML = '<option value="">请选择奖项</option>';
    
    Object.keys(prizeConfig).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = prizeConfig[key].displayName;
        select.appendChild(option);
    });

    // 重置显示为初始状态
    document.querySelector('.prize-level').textContent = '抽奖系统';
    document.querySelector('.prize-name').textContent = '欢迎使用';
    document.getElementById('currentStock').textContent = '0';
}

// 加载已有的中奖记录
function loadWinners() {
    fetch('tool/api.php/get_winners')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.message);
            }
            winners = data;
            updateWinnerList();
        })
        .catch(error => {
            console.error('读取中奖记录失败:', error);
        });
}

// 下载中奖名单
function downloadWinners() {
    // 创建CSV内容
    let csvContent = '\uFEFF工号,姓名,一级部门,奖项,奖品,中奖时间\n';
    winners.forEach(winner => {
        // 确保时间戳格式正确
        const timestamp = winner.timestamp || '';
        csvContent += `${winner.id},${winner.name},${winner.dept},${winner.prize},${winner.award},${timestamp}\n`;
    });
    
    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '中奖名单.csv';
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 抽奖函数
function drawPrize() {
    const prizeLevel = document.getElementById('prizeSelect').value;
    const prize = prizeConfig[prizeLevel];
    const drawCount = parseInt(document.getElementById('drawCount').value);
    
    // 验证选择
    if (!prizeLevel) {
        alert('请选择奖项！');
        return;
    }
    
    // 验证抽奖数量
    if (isNaN(drawCount) || drawCount < 1) {
        alert('请输入有效的抽奖人数！');
        return;
    }
    
    // 如果有多个奖品但未选择具体奖品
    if (prize.items.length > 1 && !selectedItemName) {
        alert('请选择具体奖品！');
        return;
    }
    
    // 获取选中的具体奖品
    const selectedItem = prize.items.length > 1 
        ? prize.items.find(item => item.name === selectedItemName)
        : prize.items[0];
    
    if (!selectedItem || selectedItem.stock < drawCount) {
        alert('该奖品剩余数量不足！');
        return;
    }
    
    // 获取可参与抽奖的教师列表
    const availableTeachers = teachers.filter(teacher => 
        !winners.some(winner => winner.id === teacher.id)
    );

    if (availableTeachers.length < drawCount) {
        alert('可参与抽奖的教师人数不足！');
        return;
    }
    
    // 如果正在滚动，则停止抽奖
    if (isRolling) {
        stopRolling(availableTeachers, drawCount, prize, prizeLevel);
        return;
    }

    // 开始滚动效果
    startRolling(availableTeachers);
    
    // 更改按钮文字
    document.querySelector('.draw-btn').textContent = '停止抽奖';
}

// 开始滚动效果
function startRolling(availableTeachers) {
    isRolling = true;
    const winnerList = document.getElementById("winner-list");
    const drawCount = parseInt(document.getElementById('drawCount').value);
    
    rollInterval = setInterval(() => {
        // 清空表格
        winnerList.innerHTML = '';
        
        // 随机显示与抽人数相同数量的人
        for (let i = 0; i < drawCount; i++) {
            const randomIndex = Math.floor(Math.random() * availableTeachers.length);
            const teacher = availableTeachers[randomIndex];
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${teacher.id}</td>
                <td>${teacher.name}</td>
                <td>${teacher.dept}</td>
                <td>---</td>
                <td>---</td>
            `;
            row.style.animation = 'flash 0.5s';
            winnerList.appendChild(row);
        }
    }, 100); // 每100ms更新一次
}

// 停止滚动并显示中奖结果
function stopRolling(availableTeachers, drawCount, prize, prizeLevel) {
    isRolling = false;
    clearInterval(rollInterval);
    document.querySelector('.draw-btn').textContent = '开始抽奖';
    
    const winnerList = document.getElementById("winner-list");
    winnerList.innerHTML = '';
    
    // 执行实际的抽奖逻辑
    const currentWinners = [];
    for (let i = 0; i < drawCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableTeachers.length);
        const winner = availableTeachers.splice(randomIndex, 1)[0];
        
        // 如果有选中的具体奖品，就使用选中的奖品
        let selectedItem;
        if (selectedItemName) {
            selectedItem = prize.items.find(item => item.name === selectedItemName);
        } else {
            const availableItems = prize.items.filter(item => item.stock > 0);
            selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        }
        
        if (!selectedItem || selectedItem.stock === 0) {
            alert('该奖品已抽完！');
            return;
        }
        
        // 移除奖品名称中的数量信息
        const displayAward = selectedItem.name.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
        
        const winnerRecord = {
            ...winner,
            prize: prizeLevel,
            award: displayAward
        };
        
        currentWinners.push(winnerRecord);
        
        // 创建中奖行并添加高亮效果
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${winner.id}</td>
            <td>${winner.name}</td>
            <td>${winner.dept}</td>
            <td>${prizeLevel}</td>
            <td>${displayAward}</td>
        `;
        row.classList.add('highlight');
        winnerList.appendChild(row);
        
        // 更新库存和保存记录
        updatePrizeStock(prizeLevel, selectedItem.name);
        saveWinner(winnerRecord);
    }

    // 设置抽奖结果标志
    hasDrawnResult = true;
    
    // 更新显示剩余数量
    if (selectedItemName) {
        const selectedItem = prize.items.find(item => item.name === selectedItemName);
        if (selectedItem) {
            const displayName = selectedItem.name.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
            document.querySelector('.prize-name').textContent = `${displayName}（剩余${selectedItem.stock}）`;
            document.getElementById('currentStock').textContent = selectedItem.stock;
        }
    }
}

// 保存中奖记录
function saveWinner(winner) {
    fetch('tool/api.php/save_winner', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(winner)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.message);
        }
        winners.push(winner);
        
        // 获取最新的奖品配置
        return fetch('tool/api.php/get_prizes');
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.message);
        }
        // 更新奖品配置
        prizeConfig = data;
        // 更新显示
        updatePrizeDisplay(winner);
    })
    .catch(error => {
        console.error('保存中奖记录失败:', error);
        alert('保存中奖记录失败：' + error.message);
    });
}

// 更新奖项显示
function updatePrizeDisplay(winner) {
    const prizeInfo = prizeConfig[winner.prize];
    if (!prizeInfo) return;

    document.querySelector('.prize-level').textContent = prizeInfo.displayName;
    
    // 获取所有剩余奖品的库存信息，只显示库存大于0的
    const remainingPrizes = prizeInfo.items
        .filter(item => item.stock > 0) // 只显示库存大于0的项目
        .map(item => {
            // 保持原始名称格式，添加剩余数量
            return `${item.name}（剩余${item.stock}）`;
        })
        .join('，');
    
    // 更新奖品名称显示，包含库存信息
    document.querySelector('.prize-name').textContent = remainingPrizes || '该奖项已抽完';
}

// 更新获奖者列表显示
function updateWinnerList() {
    const winnerList = document.getElementById("winner-list");
    winnerList.innerHTML = '';
    
    // 获取最近一次抽奖的时间戳
    const latestTimestamp = winners.length > 0 ? 
        winners[winners.length - 1].timestamp : null;
    
    if (latestTimestamp) {
        // 筛选最近一次抽奖的所有中奖者
        const latestWinners = winners.filter(winner => 
            winner.timestamp === latestTimestamp
        );
        
        // 显示最近一次的中奖者
        latestWinners.forEach(winner => {
            // 移除奖品名称中的数量信息
            const displayAward = winner.award.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${winner.id}</td>
                <td>${winner.name}</td>
                <td>${winner.dept}</td>
                <td>${winner.prize}</td>
                <td>${displayAward}</td>
            `;
            winnerList.appendChild(row);
        });
    }
}

// 加页面切换功能
function toggleSettings() {
    const mainContent = document.querySelector('.main-content');
    const prizeSettings = document.querySelector('.prize-settings');
    
    if (mainContent.style.display === 'none') {
        mainContent.style.display = 'block';
        prizeSettings.style.display = 'none';
    } else {
        mainContent.style.display = 'none';
        prizeSettings.style.display = 'block';
    }
}

// 修改奖项选择变化时的处理
document.getElementById('prizeSelect').addEventListener('change', function(e) {
    const selectedPrize = e.target.value;
    const itemSelect = document.getElementById('itemSelect');
    
    // 重置二级选择框
    itemSelect.innerHTML = '<option value="">请选择奖品</option>';
    
    if (!selectedPrize) {
        itemSelect.style.display = 'none';
        document.querySelector('.prize-level').textContent = '抽奖系统';
        document.querySelector('.prize-name').textContent = '欢迎使用';
        document.getElementById('currentStock').textContent = '0';
        return;
    }
    
    const prizeInfo = prizeConfig[selectedPrize];
    
    // 更新奖项显示
    document.querySelector('.prize-level').textContent = prizeInfo.displayName;
    
    // 如果有多个奖品，显示二级选择框
    if (prizeInfo.items.length > 1) {
        // 添加可用的奖品选项
        prizeInfo.items
            .filter(item => item.stock > 0)
            .forEach(item => {
                const option = document.createElement('option');
                option.value = item.name;
                // 移除数量信息显示简化的奖品名称
                const displayName = item.name.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
                option.textContent = `${displayName}`;
                itemSelect.appendChild(option);
            });
        
        itemSelect.style.display = 'inline-block';
        document.querySelector('.prize-name').textContent = '请选择具体奖品';
    } else {
        itemSelect.style.display = 'none';
        // 只有一个奖品时直接显示
        const item = prizeInfo.items[0];
        const displayName = item.name.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
        document.querySelector('.prize-name').textContent = `${displayName}（剩余${item.stock}）`;
    }
    
    updateStockDisplay();
});

// 添加奖品选择变化的处理
document.getElementById('itemSelect').addEventListener('change', function(e) {
    const selectedPrize = document.getElementById('prizeSelect').value;
    const selectedItem = e.target.value;
    selectedItemName = selectedItem; // 保存选中的奖品名称
    
    if (!selectedItem) {
        document.querySelector('.prize-name').textContent = '请选择具体奖品';
        document.getElementById('currentStock').textContent = '0';
        return;
    }
    
    const prizeInfo = prizeConfig[selectedPrize];
    const item = prizeInfo.items.find(item => item.name === selectedItem);
    
    if (item) {
        const displayName = item.name.replace(/\d+个|\d+台|\d+辆|\d+份|\d+张/, '');
        document.querySelector('.prize-name').textContent = `${displayName}（剩余${item.stock}）`;
        document.getElementById('currentStock').textContent = item.stock;
    }
});

// 添加更新库存显示的函数（如果还没有的话
function updateStockDisplay() {
    const selectedPrize = document.getElementById('prizeSelect').value;
    const prizeInfo = prizeConfig[selectedPrize];
    
    // 添加错误检查
    if (!prizeInfo || !prizeInfo.items) {
        console.error('无法获取奖项信息:', selectedPrize);
        document.getElementById('currentStock').textContent = '0';
        return;
    }
    
    // 计���当前奖项的总剩余数量
    const remainingStock = prizeInfo.items.reduce((total, item) => total + item.stock, 0);
    
    // 更新库存显示
    document.getElementById('currentStock').textContent = remainingStock;
}

// 确认重置
function confirmReset() {
    if (confirm('确定要重置所有抽奖数据吗？这将清空所有中奖记录！')) {
        resetDrawing();
    }
}

// 重置抽奖
function resetDrawing() {
    fetch('tool/api.php/reset_drawing', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.message);
        }
        // 重置存中的数据
        winners = [];
        // 重置标志
        hasDrawnResult = false;
        // 重置奖品库存
        resetPrizeStock();
        // 更新显示
        updateWinnerList();
        updateStockDisplay();
        // 重置显示的奖项
        document.querySelector('.prize-level').textContent = '抽奖系统';
        document.querySelector('.prize-name').textContent = '欢迎使用';
        // 重置下拉框选择
        document.getElementById('prizeSelect').value = '';
        alert('抽奖数据已重置！');
    })
    .catch(error => {
        console.error('重置失败:', error);
        alert('重置失败：' + error.message);
    });
}

// 重置奖品库存
function resetPrizeStock() {
    fetch('tool/api.php/get_prizes')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.message);
            }
            prizeConfig = data;
            updateStockDisplay();
        })
        .catch(error => {
            console.error('重置库存失败:', error);
            alert('重置库存失败：' + error.message);
        });
}

// 更新奖品库存
function updatePrizeStock(prizeLevel, itemName) {
    // 找到对应的项
    const prize = prizeConfig[prizeLevel];
    if (!prize) {
        console.error('找不到奖项:', prizeLevel);
        return;
    }
    
    // 找到对应的奖品
    const item = prize.items.find(item => item.name === itemName);
    if (!item) {
        console.error('找不到奖品:', itemName);
        return;
    }
    
    // 减少库存
    if (item.stock > 0) {
        item.stock--;
        prize.total--;
    }
    
    // 更新库存显示
    updateStockDisplay();
    
    // 将更新后的配置保存到服务器
    fetch('tool/api.php/update_prize_stock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(prizeConfig)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.message);
        }
    })
    .catch(error => {
        console.error('更新库存失败:', error);
        alert('更新库存失败：' + error.message);
    });
}

// 修改时间格式化函数
function formatDateTime(timestamp) {
    try {
        // 检查时间戳格式
        if (!timestamp) return '';
        
        // 如果时间戳包含斜杠，直接返回
        if (timestamp.includes('/')) {
            return timestamp;
        }
        
        // 处理时间戳
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return timestamp;
        }
        
        // 格式化日期时间
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/-/g, '/');
    } catch (e) {
        console.error('时间转换错误:', e);
        return timestamp;
    }
} 