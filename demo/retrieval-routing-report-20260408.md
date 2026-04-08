# 检索路由检查报告

- base_url: http://127.0.0.1:3033
- mode: mock
- model: local-mock
- retrieval_enabled: N
- passed: 10/10

## 具体公司看法
message: 对泡泡玛特这家公司你怎么看？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=true, planType=company-analysis, subject=泡泡玛特
actual: eligible=true, planType=company-analysis, subject=泡泡玛特

## 具体公司估值
message: 泡泡玛特 PE 45 倍了，还能买吗？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=true, planType=company-analysis, subject=泡泡玛特
actual: eligible=true, planType=company-analysis, subject=泡泡玛特

## 美股代码
message: AAPL 还能不能长期拿？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=true, planType=company-analysis, subject=AAPL
actual: eligible=true, planType=company-analysis, subject=AAPL

## 港股代码
message: 0700.HK 现在怎么看？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=true, planType=company-analysis, subject=0700.HK
actual: eligible=true, planType=company-analysis, subject=0700.HK

## 宽泛方法论
message: 对好公司应该怎么估值？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

## 热门但不懂
message: 现在有个很火的行业我不太懂，要不要先买一点试试？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

## 教育问题
message: 孩子对投资有兴趣，要不要很早教？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

## 人生问题
message: 人应该怎么找到自己的北斗星？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

## 创业方法论
message: 创业和打工怎么选？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

## 合作方法论
message: 遇到合作伙伴失信怎么处理？
result: PASS
checks: retrievalEligible=Y, planType=Y, subject=Y
expected: eligible=false, planType=none, subject=null
actual: eligible=false, planType=none, subject=null

