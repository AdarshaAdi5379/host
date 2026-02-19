import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { Activity, TrendingUp, TrendingDown } from 'lucide-react'
import { useState } from 'react'

// Mock analytics data
const generateMockData = () => {
    const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0') + ':00'
        return {
            time: hour,
            cpu: Math.floor(Math.random() * 40) + 20,
            ram: Math.floor(Math.random() * 30) + 40,
            bandwidth: Math.floor(Math.random() * 50) + 10,
        }
    })
    return hours
}

const weekData = [
    { day: 'Mon', cpu: 45, ram: 62, bandwidth: 28 },
    { day: 'Tue', cpu: 52, ram: 58, bandwidth: 35 },
    { day: 'Wed', cpu: 38, ram: 65, bandwidth: 42 },
    { day: 'Thu', cpu: 48, ram: 70, bandwidth: 38 },
    { day: 'Fri', cpu: 55, ram: 68, bandwidth: 45 },
    { day: 'Sat', cpu: 42, ram: 55, bandwidth: 32 },
    { day: 'Sun', cpu: 35, ram: 50, bandwidth: 25 },
]

export function Analytics() {
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
    const data = timeRange === '24h' ? generateMockData() : weekData

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Resource Analytics</h1>
                    <p className="text-gray-600 mt-1">Monitor your server performance and usage</p>
                </div>
                <div className="flex space-x-2">
                    <Button
                        variant={timeRange === '24h' ? 'primary' : 'secondary'}
                        onClick={() => setTimeRange('24h')}
                    >
                        24 Hours
                    </Button>
                    <Button
                        variant={timeRange === '7d' ? 'primary' : 'secondary'}
                        onClick={() => setTimeRange('7d')}
                    >
                        7 Days
                    </Button>
                    <Button
                        variant={timeRange === '30d' ? 'primary' : 'secondary'}
                        onClick={() => setTimeRange('30d')}
                    >
                        30 Days
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Avg CPU Usage</p>
                                <p className="text-2xl font-bold mt-1">45%</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Activity className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                        <div className="flex items-center mt-2 text-sm">
                            <TrendingDown className="w-4 h-4 text-green-600 mr-1" />
                            <span className="text-green-600">5% lower than yesterday</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Avg RAM Usage</p>
                                <p className="text-2xl font-bold mt-1">62%</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Activity className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                        <div className="flex items-center mt-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-red-600 mr-1" />
                            <span className="text-red-600">3% higher than yesterday</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Bandwidth Used</p>
                                <p className="text-2xl font-bold mt-1">28%</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Activity className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        <div className="flex items-center mt-2 text-sm">
                            <TrendingDown className="w-4 h-4 text-green-600 mr-1" />
                            <span className="text-green-600">2% lower than yesterday</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CPU & RAM Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>CPU & RAM Usage Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey={timeRange === '24h' ? 'time' : 'day'}
                                stroke="#888"
                                fontSize={12}
                            />
                            <YAxis stroke="#888" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="cpu"
                                stroke="#673DE6"
                                strokeWidth={2}
                                dot={false}
                                name="CPU %"
                            />
                            <Line
                                type="monotone"
                                dataKey="ram"
                                stroke="#00B090"
                                strokeWidth={2}
                                dot={false}
                                name="RAM %"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Bandwidth Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Bandwidth Usage</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey={timeRange === '24h' ? 'time' : 'day'}
                                stroke="#888"
                                fontSize={12}
                            />
                            <YAxis stroke="#888" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="bandwidth"
                                stroke="#2F1C6A"
                                fill="#673DE6"
                                fillOpacity={0.2}
                                name="Bandwidth %"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
