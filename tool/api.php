<?php
// 设置时区为北京时间
date_default_timezone_set('Asia/Shanghai');

header('Content-Type: application/json; charset=utf-8');

// 允许跨域请求
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 如果是 OPTIONS 请求，直接返回
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 获取请求路径
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$endpoint = basename($path);


// 根据不同的端点处理不同的请求
switch ($endpoint) {
    case 'get_teachers':
        getTeachers();
        break;
    case 'get_prizes':
        getPrizes();
        break;
    case 'get_winners':
        getWinners();
        break;
    case 'save_winner':
        saveWinner();
        break;
    case 'reset_drawing':
        resetDrawing();
        break;
    case 'update_prize_stock':
        updatePrizeStock();
        break;
    default:
        exit();
        // sendError('未知的请求端点');
}

// 获取教师数据
function getTeachers() {
    $file = '../data/teacher.csv';
    
    if (!file_exists($file)) {
        sendError('教师数据文件不存在');
        return;
    }
    
    $teachers = [];
    
    // 打开CSV文件并��置编码
    if (($handle = fopen($file, "r")) !== FALSE) {
        // 设置内部字符编码为 UTF-8
        setlocale(LC_ALL, 'zh_CN.UTF-8');
        
        // 跳过标题行 "工号,姓名,1级部门"
        fgetcsv($handle, 0, ',', '"', '\\');
        
        // 读取每一行数据
        while (($data = fgetcsv($handle, 0, ',', '"', '\\')) !== FALSE) {
            if (count($data) >= 3) {
                $teachers[] = [
                    'id' => trim($data[0]),      // 工号
                    'name' => trim($data[1]),    // 姓名
                    'dept' => trim($data[2])     // 1级部门
                ];
            }
        }
        fclose($handle);
        
        // 按工号排序
        usort($teachers, function($a, $b) {
            return strcmp($a['id'], $b['id']);
        });
        
        sendResponse($teachers);
    } else {
        sendError('无法读取教师数据文件');
    }
}

// 获取奖项配置
function getPrizes() {
    $file = '../data/prize.json';
    
    if (!file_exists($file)) {
        sendError('奖项配置文件不存在');
        return;
    }
    
    $content = file_get_contents($file);
    if ($content === false) {
        sendError('无法读取奖项配置文件');
        return;
    }
    
    // 确保正确的 JSON 编码
    $prizes = json_decode($content, true);
    if ($prizes === null) {
        sendError('奖项配置文件格式错误: ' . json_last_error_msg());
        return;
    }
    
    // 验证数据结构
    foreach ($prizes as $key => $prize) {
        if (!isset($prize['items']) || !is_array($prize['items'])) {
            sendError("奖项 {$key} 的配置格式错误");
            return;
        }
    }
    
    sendResponse($prizes);
}

// 获取中奖记录
function getWinners() {
    $file = '../data/result.json';
    
    if (!file_exists($file)) {
        sendResponse([]);
        return;
    }
    
    $winners = json_decode(file_get_contents($file), true);
    if ($winners === null) {
        sendError('中奖记录文件格式错误');
        return;
    }
    
    sendResponse($winners);
}

// 保存中奖记录
function saveWinner() {
    $file = '../data/result.json';
    
    // 获取POST数据
    $json = file_get_contents('php://input');
    $winner = json_decode($json, true);
    
    if (!$winner) {
        sendError('无效的中奖数据');
        return;
    }
    
    // ���加北京时间时间戳，使用斜杠分隔日期
    $winner['timestamp'] = date('Y/m/d H:i:s', time());
    
    // 读取现有记录
    $winners = [];
    if (file_exists($file)) {
        $winners = json_decode(file_get_contents($file), true) ?? [];
    }
    
    // 添加新记录
    $winners[] = $winner;
    
    // 保存到文件
    if (file_put_contents($file, json_encode($winners, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT))) {
        sendResponse(['success' => true]);
    } else {
        sendError('保存中奖记录失败');
    }
}

// 重置抽奖
function resetDrawing() {
    $result_file = '../data/result.json';
    $prize_file = '../data/prize.json';
    $prize_backup = '../data/prize.json.bak';
    
    // 检查备份文件是否存在
    if (!file_exists($prize_backup)) {
        sendError('奖品配置备份文件不存在');
        return;
    }
    
    // 清空中奖记录
    if (file_put_contents($result_file, '[]')) {
        // 从备份文件恢复奖品配置
        if (copy($prize_backup, $prize_file)) {
            sendResponse(['success' => true]);
        } else {
            sendError('重置奖品配置失败，请检查文件权限');
        }
    } else {
        sendError('清空中奖记录失败，请检查文件权限');
    }
}

// 添加更新奖品库存的函数
function updatePrizeStock() {
    $file = '../data/prize.json';
    
    // 获取POST数据
    $json = file_get_contents('php://input');
    $prizeConfig = json_decode($json, true);
    
    if (!$prizeConfig) {
        sendError('无效的奖品配置数据');
        return;
    }
    
    // 保存更新后的配置
    if (file_put_contents($file, json_encode($prizeConfig, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT))) {
        sendResponse(['success' => true]);
    } else {
        sendError('保存奖品配置失败');
    }
}

// 发送响应
function sendResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

// 发送错误
function sendError($message) {
    http_response_code(400);
    echo json_encode([
        'error' => true,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
}
