# EasyInput 串口桥协议

网页通过 Web Serial 读取开发板输出，不向设备写入控制命令。连接参数：

```text
baudRate: 115200
dataBits: 8
stopBits: 1
parity: none
flowControl: none
```

## JSON Lines（推荐）

每行一个 JSON 对象：

```json
{"type":"encoder","delta":1}
{"type":"encoder","delta":-1}
{"type":"encoder-press"}
{"type":"button","key":"S1","action":"down"}
{"type":"button","key":"1","action":"down"}
{"type":"button","key":"S8","action":"up"}
```

应用只使用 `down` 触发动作，`up` 会被忽略但可用于录屏证据。

## 兼容文本

```text
ENC+
ENC-
ENC_PRESS
S1_DOWN 或 1_DOWN
S2_DOWN 或 2_DOWN
S3_DOWN 或 3_DOWN
S4_DOWN 或 4_DOWN
S5_DOWN 或 5_DOWN
S6_DOWN 或 6_DOWN
S7_DOWN 或 7_DOWN
S8_DOWN 或 8_DOWN
```

## 固件侧最小要求

当前工程不修改开发板固件。如果现有固件没有以上输出，需要由固件负责把 EasyInput 的实体输入映射为这些串口行。硬件输入仍以板级事实为准：

- S1–S8：GPIO 2 / 47 / 38 / 41 / 1 / 6 / 7 / 48，低有效；
- 编码器 A/B：GPIO 17 / 16，正交相位；
- 编码器按压 S9：GPIO 18，低有效；
- GPIO0 不是 S5；
- GPIO8 是共享外设电源使能，不能当普通 LED 开关使用。

固件必须先做消抖和正交解码，再输出应用事件；不要把 A/B 相位当成两个普通按键。
