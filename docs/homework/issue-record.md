# 问题记录：WebGL 首次上传图片报错

## 现象

开发初期，浏览器控制台出现：

```text
WebGL: INVALID_VALUE: texImage2D: no image
```

首次载入示例肖像或选择图片时，主画布可能没有首帧，风格切换也无法正常预览。

## 定位

检查 `app.js` 初始化流程发现：

1. `makeSamplePortraits()` 创建 HTML `Image`；
2. `addSource()` 被立即调用；
3. `renderer.setImage()` 随即把图片对象上传给 WebGL；
4. 图片实际解码在之后才完成。

也就是 WebGL 收到的是尚未完成解码的图片对象，触发 `texImage2D` 的无效值错误。

## 处理

调整初始化顺序为：

```text
创建示例图片
  ↓
等待 image.decode()
  ↓
addSource()
  ↓
renderer.setImage() 上传 WebGL
  ↓
启动渲染循环
```

同时保留图片导入后的解码 / 尺寸归一化流程，避免不同格式和超大图片影响纹理上传。

## 验收

- 控制台不再出现 `texImage2D: no image`；
- 页面首帧正常显示；
- 10 种风格切换正常；
- 强度、圆圈内 / 外实时预览正常；
- 本地演示成片可以导出并保存。
