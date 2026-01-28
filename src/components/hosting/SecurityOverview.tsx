import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, AlertTriangle, CheckCircle, Eye } from 'lucide-react'

export function SecurityOverview() {
    const securityScore = 85

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600'
        if (score >= 60) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excellent'
        if (score >= 60) return 'Good'
        return 'Needs Attention'
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-brand-purple" />
                    <span>Security Overview</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Security Score */}
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                        <span className={`text-5xl font-bold ${getScoreColor(securityScore)}`}>
                            {securityScore}
                        </span>
                        <span className="text-2xl text-gray-400 ml-1">/100</span>
                    </div>
                    <p className="text-sm text-gray-600">
                        Security Score: <span className="font-semibold">{getScoreLabel(securityScore)}</span>
                    </p>
                </div>

                {/* Malware Scan */}
                <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h4 className="font-medium mb-1">Malware Scan</h4>
                            <p className="text-sm text-gray-600">Last scan: 2 hours ago</p>
                            <Badge variant="success" className="mt-2">
                                No threats detected
                            </Badge>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm">
                        Scan Now
                    </Button>
                </div>

                {/* WAF Status */}
                <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-medium mb-1">Web Application Firewall</h4>
                            <p className="text-sm text-gray-600">Blocked 23 threats today</p>
                            <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="info">Active</Badge>
                                <Badge variant="warning">3 new alerts</Badge>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Logs
                    </Button>
                </div>

                {/* Security Recommendations */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-yellow-900 mb-1">
                                Security Recommendations
                            </h4>
                            <ul className="text-sm text-yellow-800 space-y-1">
                                <li>• Enable two-factor authentication</li>
                                <li>• Update WordPress to latest version</li>
                                <li>• Review user permissions</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
